import type { Db, Tx } from "./db.js";

export interface AuditInput {
  actorId: string;
  action: string;
  objectId: string;
  requestId: string;
  outcome: "ok" | "denied" | "failed";
  summary: string;
}

/** Allowlisted summary fields. Never pass raw customer data here. */
export interface SummaryFields {
  kind?: string;
  customerRef?: string; // already masked
  amountMinor?: number;
  currency?: string;
  decision?: string;
  state?: string;
  reason?: string;
}

export function buildSummary(fields: SummaryFields): string {
  const parts: string[] = [];
  if (fields.kind) parts.push(`kind=${fields.kind}`);
  if (fields.customerRef) parts.push(`customer=${fields.customerRef}`);
  if (fields.amountMinor !== undefined) parts.push(`amount=${fields.amountMinor}`);
  if (fields.currency) parts.push(`currency=${fields.currency}`);
  if (fields.decision) parts.push(`decision=${fields.decision}`);
  if (fields.state) parts.push(`state=${fields.state}`);
  if (fields.reason) parts.push(`reason=${fields.reason}`);
  return parts.join(" ");
}

export async function writeAudit(tx: Tx | Db, input: AuditInput): Promise<void> {
  await tx
    .insertInto("audit_events")
    .values({
      actor_id: input.actorId,
      action: input.action,
      object_id: input.objectId,
      request_id: input.requestId,
      outcome: input.outcome,
      summary: input.summary,
    })
    .execute();
}
