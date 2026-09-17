import { vi } from "vitest";
import type { ApprovalRequestDto, ErrorCode } from "@tools/contracts";
import { HTTP_STATUS } from "@tools/contracts";

export type Handler = (method: string, path: string, body: unknown) => Response | undefined;

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export function apiError(code: ErrorCode, message: string): Response {
  return json({ code, message, requestId: "req_test" }, HTTP_STATUS[code]);
}

/** Installs a fetch mock that routes by "METHOD /path" and records calls. */
export function mockFetch(handler: Handler) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = url.replace(/^https?:\/\/[^/]+/, "");
    const method = (init?.method ?? "GET").toUpperCase();
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    calls.push({ method, path, body });
    const res = handler(method, path, body);
    if (!res) return apiError("NOT_FOUND", `unhandled ${method} ${path}`);
    return res;
  });
  vi.stubGlobal("fetch", fn);
  return { fn, calls };
}

export function pendingRefund(overrides: Partial<ApprovalRequestDto> = {}): ApprovalRequestDto {
  return {
    id: "req_0001",
    kind: "refund",
    requesterId: "u_dual",
    requesterName: "Dana Dual",
    summary: "Full refund of 49.99 USD for pay_1001",
    payload: { kind: "refund", paymentId: "pay_1001", amountMinor: 4999, currency: "USD", customerRef: "j***@example.com" },
    decision: "PENDING",
    decidedById: null,
    decidedAt: null,
    execution: "NONE",
    executionResult: null,
    createdAt: "2026-09-15T10:00:00Z",
    ...overrides,
  };
}
