import {
  ActionAccepted,
  ApiError,
  ApprovalResponse,
  ApprovalsResponse,
  AuditResponse,
  FlagsResponse,
  MeResponse,
  PaymentsResponse,
} from "@tools/contracts";
import type { DemoUserKey, ErrorCode } from "@tools/contracts";
import { z } from "zod";
import { createFixtureFetch } from "./fixtures";

/** Fixtures are used ONLY when the flag is explicitly "1". There is no fallback on network failure. */
export const USE_FIXTURES = import.meta.env.VITE_USE_FIXTURES === "1";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: ErrorCode | "UNKNOWN";
  readonly requestId: string | null;
  constructor(status: number, code: ErrorCode | "UNKNOWN", message: string, requestId: string | null) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

let fixtureFetch: typeof fetch | null = null;
function resolveFetch(): typeof fetch {
  if (USE_FIXTURES) {
    fixtureFetch ??= createFixtureFetch();
    return fixtureFetch;
  }
  return (input, init) => globalThis.fetch(input, init);
}

async function request<S extends z.ZodTypeAny>(schema: S, method: "GET" | "POST", path: string, body?: unknown): Promise<z.infer<S>> {
  const init: RequestInit = {
    method,
    credentials: "same-origin",
    headers: { "content-type": "application/json", accept: "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
  let res: Response;
  try {
    res = await resolveFetch()(path, init);
  } catch (e) {
    throw new ApiClientError(0, "UNKNOWN", `Network error: ${e instanceof Error ? e.message : String(e)}`, null);
  }
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  if (!res.ok) {
    const err = ApiError.safeParse(json);
    if (err.success) throw new ApiClientError(res.status, err.data.code, err.data.message, err.data.requestId);
    throw new ApiClientError(res.status, "UNKNOWN", `HTTP ${res.status} ${res.statusText || ""}`.trim(), null);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiClientError(res.status, "UNKNOWN", `Response did not match contract for ${method} ${path}: ${parsed.error.message}`, null);
  }
  return parsed.data;
}

export const api = {
  demoSession: (user: DemoUserKey) => request(z.unknown(), "POST", "/api/demo/session", { user }),
  me: () => request(MeResponse, "GET", "/api/me"),
  payments: () => request(PaymentsResponse, "GET", "/api/refunds/payments"),
  requestRefund: (paymentId: string) => request(ActionAccepted, "POST", "/api/actions/refunds.request", { paymentId }),
  approvals: () => request(ApprovalsResponse, "GET", "/api/approvals"),
  approval: (id: string) => request(ApprovalResponse, "GET", `/api/approvals/${encodeURIComponent(id)}`),
  decide: (requestId: string, decision: "approve" | "reject") =>
    request(ActionAccepted, "POST", "/api/actions/approvals.decide", { requestId, decision }),
  audit: (requestId: string) => request(AuditResponse, "GET", `/api/audit?requestId=${encodeURIComponent(requestId)}`),
  flags: () => request(FlagsResponse, "GET", "/api/flags"),
  proposeFlag: (flagKey: string, expectedVersion: number, newValue: boolean) =>
    request(ActionAccepted, "POST", "/api/actions/flags.propose", { flagKey, expectedVersion, newValue }),
};

export function describeError(e: unknown): { code: string; message: string; requestId: string | null; status: number } {
  if (e instanceof ApiClientError) return { code: e.code, message: e.message, requestId: e.requestId, status: e.status };
  return { code: "UNKNOWN", message: e instanceof Error ? e.message : String(e), requestId: null, status: 0 };
}
