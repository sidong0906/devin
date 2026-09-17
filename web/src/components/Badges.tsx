import type { DecisionState, ExecutionState } from "@tools/contracts";

const EXECUTION_LABELS: Record<ExecutionState, { label: string; tone: string; title: string }> = {
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
    <span className={`badge badge-${meta.tone}`} title={meta.title} data-state={state}>
      {meta.label}
    </span>
  );
}

const DECISION_TONE: Record<DecisionState, string> = { PENDING: "pending", APPROVED: "ok", REJECTED: "danger" };

export function DecisionBadge({ state }: { state: DecisionState }) {
  return (
    <span className={`badge badge-${DECISION_TONE[state]}`} data-state={state}>
      {state.charAt(0) + state.slice(1).toLowerCase()}
    </span>
  );
}

export function PermissionChip({ permission }: { permission: string }) {
  return <span className="chip">{permission}</span>;
}
