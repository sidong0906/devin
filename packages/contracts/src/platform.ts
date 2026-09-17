import { z } from "zod";
import { RefundPayload } from "./refunds.js";
import { FlagChangePayload } from "./flags.js";

// ---------- Identity & permissions ----------

/** Every permission any app may require. Adding an app adds its `<app>.<verb>` entries here. */
export const Permission = z.enum([
  "refunds.request",
  "refunds.review",
  "flags.propose",
  "flags.review",
  "approvals.read",
  "audit.read",
]);
export type Permission = z.infer<typeof Permission>;

export const Actor = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  permissions: z.array(Permission),
});
export type Actor = z.infer<typeof Actor>;

/** Seeded demo identities. `dual` exists so the self-approval test is meaningful. */
export const DEMO_USERS = {
  agent: { id: "u_agent", displayName: "Ana Agent", permissions: ["refunds.request", "approvals.read"] },
  reviewer: { id: "u_reviewer", displayName: "Raj Reviewer", permissions: ["refunds.review", "flags.review", "approvals.read"] },
  dual: { id: "u_dual", displayName: "Dana Dual", permissions: ["refunds.request", "refunds.review", "flags.propose", "flags.review", "approvals.read"] },
  auditor: { id: "u_auditor", displayName: "Avery Auditor", permissions: ["approvals.read", "audit.read"] },
} as const satisfies Record<string, Actor>;
export type DemoUserKey = keyof typeof DEMO_USERS;
export const DemoUserKey = z.enum(["agent", "reviewer", "dual", "auditor"]);

export const SESSION_COOKIE = "tools_session";

// ---------- Action names & error shape ----------

/** Mutations reachable via `POST /api/actions/:name`. Unknown names are denied. */
export const ActionName = z.enum(["refunds.request", "approvals.decide", "flags.propose"]);
export type ActionName = z.infer<typeof ActionName>;

export const ErrorCode = z.enum([
  "UNAUTHENTICATED", // 401
  "FORBIDDEN", // 403 permission missing
  "SELF_APPROVAL", // 403 maker == checker
  "NOT_FOUND", // 404
  "ALREADY_DECIDED", // 409
  "DUPLICATE_REQUEST", // 409 one refund request per payment
  "STALE_VERSION", // 409 flags expected-version mismatch
  "VALIDATION", // 422
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const HTTP_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  SELF_APPROVAL: 403,
  NOT_FOUND: 404,
  ALREADY_DECIDED: 409,
  DUPLICATE_REQUEST: 409,
  STALE_VERSION: 409,
  VALIDATION: 422,
};

export const ApiError = z.object({
  code: ErrorCode,
  message: z.string(),
  requestId: z.string(),
});
export type ApiError = z.infer<typeof ApiError>;

// ---------- Approval workflow ----------

export const DecisionState = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export type DecisionState = z.infer<typeof DecisionState>;

export const ExecutionState = z.enum(["NONE", "QUEUED", "LEASED", "RETRY_WAIT", "SUCCEEDED", "NEEDS_REVIEW"]);
export type ExecutionState = z.infer<typeof ExecutionState>;

/** One entry per app request kind; the payload union below must list the matching schema. */
export const RequestKind = z.enum(["refund", "flag_change"]);
export type RequestKind = z.infer<typeof RequestKind>;

export const RequestPayload = z.discriminatedUnion("kind", [RefundPayload, FlagChangePayload]);
export type RequestPayload = z.infer<typeof RequestPayload>;

export const ApprovalRequestDto = z.object({
  id: z.string(),
  kind: RequestKind,
  requesterId: z.string(),
  requesterName: z.string(),
  summary: z.string(), // human-readable, PII-free
  payload: RequestPayload, // customerRef is already masked when it leaves the server
  decision: DecisionState,
  decidedById: z.string().nullable(),
  decidedAt: z.string().nullable(),
  execution: ExecutionState,
  executionResult: z.object({ providerRef: z.string().nullable(), attempts: z.number().int(), lastError: z.string().nullable() }).nullable(),
  createdAt: z.string(),
});
export type ApprovalRequestDto = z.infer<typeof ApprovalRequestDto>;

export const AuditEventDto = z.object({
  id: z.number().int(),
  at: z.string(),
  actorId: z.string(), // "system:worker" for worker events
  action: z.string(), // e.g. "refunds.request", "approvals.decide", "execution.succeeded"
  objectId: z.string(),
  requestId: z.string(),
  outcome: z.enum(["ok", "denied", "failed"]),
  summary: z.string(), // allowlisted, PII-free
});
export type AuditEventDto = z.infer<typeof AuditEventDto>;

// ---------- HTTP surface ----------

export const DemoSessionBody = z.object({ user: DemoUserKey }).strict();
export const DecideBody = z.object({ requestId: z.string().min(1), decision: z.enum(["approve", "reject"]) }).strict();

export const PLATFORM_ROUTES = {
  demoSession: "POST /api/demo/session",
  me: "GET /api/me",
  approvals: "GET /api/approvals",
  approval: "GET /api/approvals/:id",
  decide: "POST /api/actions/approvals.decide",
  audit: "GET /api/audit?requestId=",
} as const;

export const MeResponse = Actor;
export const ApprovalsResponse = z.object({ requests: z.array(ApprovalRequestDto) });
export const ApprovalResponse = ApprovalRequestDto;
export const AuditResponse = z.object({ events: z.array(AuditEventDto) });
export const ActionAccepted = z.object({ requestId: z.string(), request: ApprovalRequestDto });
