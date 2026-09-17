import type { DecisionState, ExecutionState } from "@tools/contracts";
import { Badge, Chip, type Tone } from "@tools/ui";

/** The single place that decides which tone each contract state gets. See packages/ui/README.md "Tone". */
export const EXECUTION_LABELS: Record<ExecutionState, { label: string; tone: Tone; title: string }> = {
  NONE: { label: "Not executed", tone: "neutral", title: "No execution job exists for this request" },
  QUEUED: { label: "Queued", tone: "pending", title: "Execution job created, waiting for a worker" },
  LEASED: { label: "Running", tone: "pending", title: "A worker holds the lease and is calling the payment provider" },
  RETRY_WAIT: { label: "Retry wait", tone: "pending", title: "Last attempt failed; retry scheduled with the same idempotency key" },
  SUCCEEDED: { label: "Succeeded", tone: "ok", title: "Provider confirmed exactly one refund" },
  NEEDS_REVIEW: { label: "Needs review", tone: "warn", title: "Outcome unresolved after retries — NOT a success; manual reconciliation required" },
};

export function ExecutionBadge({ state }: { state: ExecutionState }) {
  const meta = EXECUTION_LABELS[state];
  return (
    <Badge tone={meta.tone} title={meta.title} data-state={state}>
      {meta.label}
    </Badge>
  );
}

export const DECISION_TONE: Record<DecisionState, Tone> = { PENDING: "pending", APPROVED: "ok", REJECTED: "danger" };

export function DecisionBadge({ state }: { state: DecisionState }) {
  return (
    <Badge tone={DECISION_TONE[state]} data-state={state}>
      {state.charAt(0) + state.slice(1).toLowerCase()}
    </Badge>
  );
}

const OUTCOME_TONE: Record<"ok" | "denied" | "failed", Tone> = { ok: "ok", denied: "danger", failed: "warn" };

export function OutcomeBadge({ outcome }: { outcome: keyof typeof OUTCOME_TONE }) {
  return <Badge tone={OUTCOME_TONE[outcome]} data-outcome={outcome}>{outcome}</Badge>;
}

export function PermissionChip({ permission }: { permission: string }) {
  return <Chip>{permission}</Chip>;
}
