import type { ApprovalRequestDto, ExecutionState } from "@tools/contracts";
import type { Slice, TrendPoint } from "@tools/ui";
import { DECISION_TONE, EXECUTION_LABELS } from "./Badges";

/** Pure aggregations over the approvals list. Charts render these; the tables remain the record. */

export type Counts = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  succeeded: number;
  inFlight: number;
  needsReview: number;
};

export function countRequests(requests: readonly ApprovalRequestDto[]): Counts {
  const c: Counts = { total: requests.length, pending: 0, approved: 0, rejected: 0, succeeded: 0, inFlight: 0, needsReview: 0 };
  for (const r of requests) {
    if (r.decision === "PENDING") c.pending++;
    else if (r.decision === "APPROVED") c.approved++;
    else c.rejected++;
    if (r.execution === "SUCCEEDED") c.succeeded++;
    else if (r.execution === "NEEDS_REVIEW") c.needsReview++;
    else if (r.execution !== "NONE") c.inFlight++;
  }
  return c;
}

export function decisionSlices(requests: readonly ApprovalRequestDto[]): Slice[] {
  const c = countRequests(requests);
  return [
    { label: "Pending", value: c.pending, tone: DECISION_TONE.PENDING },
    { label: "Approved", value: c.approved, tone: DECISION_TONE.APPROVED },
    { label: "Rejected", value: c.rejected, tone: DECISION_TONE.REJECTED },
  ];
}

/** Execution states for approved requests that carry a job; `NONE` is excluded (flags publish in the approval transaction). */
export function executionSlices(requests: readonly ApprovalRequestDto[]): Slice[] {
  const order: ExecutionState[] = ["QUEUED", "LEASED", "RETRY_WAIT", "SUCCEEDED", "NEEDS_REVIEW"];
  return order.map((state) => ({
    label: EXECUTION_LABELS[state].label,
    value: requests.filter((r) => r.execution === state).length,
    tone: EXECUTION_LABELS[state].tone,
  }));
}

export function countBy<K extends string>(requests: readonly ApprovalRequestDto[], key: (r: ApprovalRequestDto) => K): Map<K, number> {
  const m = new Map<K, number>();
  for (const r of requests) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return m;
}

const dayKey = (iso: string) => iso.slice(0, 10);

/** One point per day for the last `days` days (UTC), one column per `kind`, zero-filled. */
export function requestsPerDay(requests: readonly ApprovalRequestDto[], kinds: readonly string[], days: number, now = new Date()): TrendPoint[] {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const points: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end.getTime() - i * 86_400_000);
    const key = dayKey(d.toISOString());
    const point: TrendPoint = { label: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), day: key };
    for (const k of kinds) point[k] = 0;
    points.push(point);
  }
  const byDay = new Map(points.map((p) => [p.day, p]));
  for (const r of requests) {
    const p = byDay.get(dayKey(r.createdAt));
    if (p && kinds.includes(r.kind)) p[r.kind] = Number(p[r.kind] ?? 0) + 1;
  }
  return points;
}

export function newestFirst(requests: readonly ApprovalRequestDto[]): ApprovalRequestDto[] {
  return [...requests].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

/** Median minutes from creation to decision, for decided requests. Null when nothing has been decided. */
export function medianDecisionMinutes(requests: readonly ApprovalRequestDto[]): number | null {
  const mins = requests
    .filter((r) => r.decidedAt !== null)
    .map((r) => (new Date(r.decidedAt ?? r.createdAt).getTime() - new Date(r.createdAt).getTime()) / 60_000)
    .filter((m) => Number.isFinite(m) && m >= 0)
    .sort((a, b) => a - b);
  if (mins.length === 0) return null;
  const mid = Math.floor(mins.length / 2);
  const median = mins.length % 2 ? mins[mid] : ((mins[mid - 1] ?? 0) + (mins[mid] ?? 0)) / 2;
  return median === undefined ? null : Math.round(median * 10) / 10;
}
