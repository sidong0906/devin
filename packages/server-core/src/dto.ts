import {
  ApprovalRequestDto as ApprovalRequestDtoSchema,
  AuditEventDto as AuditEventDtoSchema,
  DEMO_USERS,
  DecisionState,
  ExecutionState,
  RequestKind,
  RequestPayload,
  type ApprovalRequestDto,
  type AuditEventDto,
} from "@tools/contracts";
import type { ApprovalRequestRow, AuditEventRow, ExecutionJobRow } from "./db.js";
import { buildSummary } from "./audit.js";

export function iso(d: Date | string | null): string | null {
  if (d === null) return null;
  return typeof d === "string" ? new Date(d).toISOString() : d.toISOString();
}

export function displayNameFor(actorId: string): string {
  const user = Object.values(DEMO_USERS).find((u) => u.id === actorId);
  return user?.displayName ?? actorId;
}

type Summarizer<K extends RequestPayload["kind"]> = (payload: Extract<RequestPayload, { kind: K }>) => string;
const summarizers = new Map<string, (payload: RequestPayload) => string>();

/** Apps register how their request kind is described in DTOs. Summaries must be PII-free (use `buildSummary`). */
export function registerRequestSummary<K extends RequestPayload["kind"]>(kind: K, fn: Summarizer<K>): void {
  summarizers.set(kind, fn as (payload: RequestPayload) => string);
}

export function requestSummary(payload: RequestPayload): string {
  const fn = summarizers.get(payload.kind);
  return fn ? fn(payload) : buildSummary({ kind: payload.kind });
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
