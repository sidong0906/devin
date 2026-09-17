import { z } from "zod";

/**
 * FROZEN CONTRACT. Owned by the coordinator. Backend and UI build against this file.
 * A child session that needs a change here must stop and report it instead of editing.
 */

// ---------- Identity & permissions ----------

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

// ---------- Action names & error shape ----------

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

// ---------- Domain ----------

export const DecisionState = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export type DecisionState = z.infer<typeof DecisionState>;

export const ExecutionState = z.enum(["NONE", "QUEUED", "LEASED", "RETRY_WAIT", "SUCCEEDED", "NEEDS_REVIEW"]);
export type ExecutionState = z.infer<typeof ExecutionState>;

export const RequestKind = z.enum(["refund", "flag_change"]);
export type RequestKind = z.infer<typeof RequestKind>;

/** Server-derived, immutable once submitted. Amount in minor units (cents). */
export const RefundPayload = z.object({
  kind: z.literal("refund"),
  paymentId: z.string(),
  amountMinor: z.number().int().positive(),
  currency: z.literal("USD"),
  customerRef: z.string(), // masked in DTOs, never raw
});
export const FlagChangePayload = z.object({
  kind: z.literal("flag_change"),
  flagKey: z.string(),
  expectedVersion: z.number().int().nonnegative(),
  newValue: z.boolean(),
});
export const RequestPayload = z.discriminatedUnion("kind", [RefundPayload, FlagChangePayload]);
export type RequestPayload = z.infer<typeof RequestPayload>;

/** Masked view of a seeded payment. Email is masked server-side. */
export const PaymentDto = z.object({
  id: z.string(),
  amountMinor: z.number().int(),
  currency: z.literal("USD"),
  customerEmailMasked: z.string(), // e.g. "j***@example.com"
  capturedAt: z.string(),
  refundRequestId: z.string().nullable(),
});
export type PaymentDto = z.infer<typeof PaymentDto>;

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
export const RefundRequestBody = z.object({ paymentId: z.string().min(1) }).strict();
export const DecideBody = z.object({ requestId: z.string().min(1), decision: z.enum(["approve", "reject"]) }).strict();
export const FlagProposeBody = z.object({ flagKey: z.string().min(1), expectedVersion: z.number().int().nonnegative(), newValue: z.boolean() }).strict();

export const ROUTES = {
  demoSession: "POST /api/demo/session",
  me: "GET /api/me",
  payments: "GET /api/refunds/payments",
  refundRequest: "POST /api/actions/refunds.request",
  approvals: "GET /api/approvals",
  approval: "GET /api/approvals/:id",
  decide: "POST /api/actions/approvals.decide",
  audit: "GET /api/audit?requestId=",
  flags: "GET /api/flags",
  flagPropose: "POST /api/actions/flags.propose",
} as const;

export const MeResponse = Actor;
export const PaymentsResponse = z.object({ payments: z.array(PaymentDto) });
export const ApprovalsResponse = z.object({ requests: z.array(ApprovalRequestDto) });
export const ApprovalResponse = ApprovalRequestDto;
export const AuditResponse = z.object({ events: z.array(AuditEventDto) });
export const ActionAccepted = z.object({ requestId: z.string(), request: ApprovalRequestDto });

export const SESSION_COOKIE = "tools_session";

/** Seeded payments. Deterministic so UI fixtures and backend seeds agree. */
export const SEED_PAYMENTS = [
  { id: "pay_1001", amountMinor: 4999, currency: "USD", customerEmail: "jordan.lee@example.com", capturedAt: "2026-09-10T14:03:00Z" },
  { id: "pay_1002", amountMinor: 12900, currency: "USD", customerEmail: "priya.n@example.com", capturedAt: "2026-09-11T09:41:00Z" },
  { id: "pay_1003", amountMinor: 250, currency: "USD", customerEmail: "sam.okafor@example.com", capturedAt: "2026-09-12T18:20:00Z" },
] as const;

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local[0]}***@${domain}`;
}
