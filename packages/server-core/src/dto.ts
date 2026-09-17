import {
  ApprovalRequestDto as ApprovalRequestDtoSchema,
  AuditEventDto as AuditEventDtoSchema,
  DEMO_USERS,
  DecisionState,
  ExecutionState,
  PaymentDto as PaymentDtoSchema,
  RequestKind,
  RequestPayload,
  maskEmail,
  type ApprovalRequestDto,
  type AuditEventDto,
  type PaymentDto,
} from "@tools/contracts";
import type { ApprovalRequestRow, AuditEventRow, ExecutionJobRow, PaymentRow } from "./db.js";
import { buildSummary } from "./audit.js";

function iso(d: Date | string | null): string | null {
  if (d === null) return null;
  return typeof d === "string" ? new Date(d).toISOString() : d.toISOString();
}

export function displayNameFor(actorId: string): string {
  const user = Object.values(DEMO_USERS).find((u) => u.id === actorId);
  return user?.displayName ?? actorId;
}

export function requestSummary(payload: RequestPayload): string {
  if (payload.kind === "refund") {
    return buildSummary({ kind: "refund", customerRef: payload.customerRef, amountMinor: payload.amountMinor, currency: payload.currency });
  }
  return buildSummary({ kind: "flag_change", reason: `${payload.flagKey}->${payload.newValue}` });
}

export function toExecutionState(job: Pick<ExecutionJobRow, "state"> | null | undefined): ApprovalRequestDto["execution"] {
  if (!job) return "NONE";
  const parsed = ExecutionState.safeParse(job.state);
  return parsed.success ? parsed.data : "NEEDS_REVIEW";
}

export function toApprovalRequestDto(
  row: ApprovalRequestRow,
  job: Pick<ExecutionJobRow, "state" | "provider_ref" | "attempts" | "last_error"> | null | undefined,
): ApprovalRequestDto {
  const payload = RequestPayload.parse(row.payload);
  const dto: ApprovalRequestDto = {
    id: row.id,
    kind: RequestKind.parse(row.kind),
    requesterId: row.requester_id,
    requesterName: displayNameFor(row.requester_id),
    summary: requestSummary(payload),
    payload,
    decision: DecisionState.parse(row.decision),
    decidedById: row.decided_by_id,
    decidedAt: iso(row.decided_at),
    execution: toExecutionState(job),
    executionResult: job ? { providerRef: job.provider_ref, attempts: job.attempts, lastError: job.last_error } : null,
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
  };
  return ApprovalRequestDtoSchema.parse(dto);
}

export function toPaymentDto(row: PaymentRow, refundRequestId: string | null): PaymentDto {
  return PaymentDtoSchema.parse({
    id: row.id,
    amountMinor: row.amount_minor,
    currency: row.currency,
    customerEmailMasked: maskEmail(row.customer_email),
    capturedAt: iso(row.captured_at),
    refundRequestId,
  });
}

export function toAuditEventDto(row: AuditEventRow): AuditEventDto {
  return AuditEventDtoSchema.parse({
    id: Number(row.id),
    at: iso(row.at),
    actorId: row.actor_id,
    action: row.action,
    objectId: row.object_id,
    requestId: row.request_id,
    outcome: row.outcome,
    summary: row.summary,
  });
}
