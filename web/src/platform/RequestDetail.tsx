import { useCallback, useEffect, useState } from "react";
import type { Actor, ApprovalRequestDto, ExecutionState } from "@tools/contracts";
import { ApiClientError, api } from "../api/client";
import { formatDate } from "../format";
import { DecisionBadge, ExecutionBadge } from "../components/Badges";
import { ErrorBox } from "../components/ErrorBox";
import { AuditTimeline } from "./AuditTimeline";
import { appForKind } from "../apps";
import { GenericPayloadFields } from "./GenericPayloadFields";

type Props = { actor: Actor; requestId: string; onNavigate: (hash: string) => void };

const IN_FLIGHT: ReadonlySet<ExecutionState> = new Set<ExecutionState>(["QUEUED", "LEASED", "RETRY_WAIT"]);

export function RequestDetail({ actor, requestId, onNavigate }: Props) {
  const [request, setRequest] = useState<ApprovalRequestDto | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [decideError, setDecideError] = useState<unknown>(null);
  const [conflict, setConflict] = useState<ApiClientError | null>(null);
  const [deciding, setDeciding] = useState<"approve" | "reject" | null>(null);
  const [auditKey, setAuditKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await api.approval(requestId);
      setRequest(r);
      setLoadError(null);
      setAuditKey((k) => k + 1);
    } catch (e) {
      setLoadError(e);
    }
  }, [requestId]);

  useEffect(() => {
    setRequest(null);
    setDecideError(null);
    setConflict(null);
    void load();
  }, [load, actor.id]);

  const polling = request !== null && IN_FLIGHT.has(request.execution);
  useEffect(() => {
    if (!polling) return;
    const t = setInterval(() => void load(), 1000);
    return () => clearInterval(t);
  }, [polling, load]);

  async function decide(decision: "approve" | "reject") {
    setDeciding(decision);
    setDecideError(null);
    setConflict(null);
    try {
      const res = await api.decide(requestId, decision);
      setRequest(res.request);
      setAuditKey((k) => k + 1);
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "ALREADY_DECIDED") {
        setConflict(e);
        await load();
      } else {
        setDecideError(e);
        setAuditKey((k) => k + 1);
      }
    } finally {
      setDeciding(null);
    }
  }

  const back = (
    <a href="#/approvals" onClick={(e) => { e.preventDefault(); onNavigate("#/approvals"); }}>
      ← Approvals queue
    </a>
  );

  if (loadError && !request) {
    return (
      <section>
        {back}
        <h2>Request {requestId}</h2>
        <ErrorBox error={loadError} prefix="Could not load request:" />
      </section>
    );
  }
  if (!request) {
    return (
      <section>
        {back}
        <h2>Request {requestId}</h2>
        <p className="muted">Loading request…</p>
      </section>
    );
  }

  const app = appForKind(request.kind);
  const PayloadFields = app?.PayloadFields ?? GenericPayloadFields;
  const canReview = app ? actor.permissions.includes(app.reviewPermission) : false;
  const isRequester = actor.id === request.requesterId;
  const pending = request.decision === "PENDING";
  const selfApproval = decideError instanceof ApiClientError && decideError.code === "SELF_APPROVAL";
  const exec = request.executionResult;

  return (
    <section>
      {back}
      <div className="section-head">
        <h2>
          Request <code>{request.id}</code>
        </h2>
        <div className="chips">
          <DecisionBadge state={request.decision} />
          <ExecutionBadge state={request.execution} />
          {polling ? <span className="muted small" aria-live="polite">polling every 1s…</span> : null}
        </div>
      </div>
      {loadError ? <ErrorBox error={loadError} prefix="Refresh failed (showing last known state):" /> : null}

      <div className="grid-2">
        <div className="card">
          <h3>Immutable payload</h3>
          <dl className="kv">
            <dt>Kind</dt><dd><code>{request.payload.kind}</code></dd>
            <PayloadFields payload={request.payload} />
            <dt>Summary</dt><dd>{request.summary}</dd>
            <dt>Requested by</dt><dd>{request.requesterName} <span className="muted small">({request.requesterId})</span></dd>
            <dt>Created</dt><dd>{formatDate(request.createdAt)}</dd>
          </dl>
        </div>

        <div className="card">
          <h3>Decision</h3>
          <dl className="kv">
            <dt>State</dt><dd><DecisionBadge state={request.decision} /></dd>
            <dt>Decided by</dt><dd>{request.decidedById ?? <span className="muted">—</span>}</dd>
            <dt>Decided at</dt><dd>{formatDate(request.decidedAt)}</dd>
          </dl>

          {conflict ? (
            <div className="alert alert-warn" role="alert" data-testid="conflict">
              <strong>Conflict — already decided.</strong> The server rejected this decision with <code>409 ALREADY_DECIDED</code>: {conflict.message}. The record below has been refreshed to the authoritative state.
            </div>
          ) : null}
          {selfApproval ? (
            <div className="alert alert-error" role="alert" data-testid="self-approval">
              <strong>Self-approval blocked (403 SELF_APPROVAL).</strong> You requested this; a different reviewer must decide.
              <div className="muted small">Server: {decideError instanceof Error ? decideError.message : ""}</div>
            </div>
          ) : null}
          {decideError && !selfApproval ? <ErrorBox error={decideError} prefix="Decision rejected by server:" /> : null}

          {pending && canReview ? (
            <div className="actions-row">
              <button className="btn" disabled={deciding !== null} onClick={() => void decide("approve")}>
                {deciding === "approve" ? "Approving…" : "Approve"}
              </button>
              <button className="btn btn-danger" disabled={deciding !== null} onClick={() => void decide("reject")}>
                {deciding === "reject" ? "Rejecting…" : "Reject"}
              </button>
              {isRequester ? <span className="muted small">You are the requester — the server will refuse (maker-checker).</span> : null}
            </div>
          ) : null}
          {pending && !canReview ? (
            <p className="muted">
              Deciding requires <code>{app?.reviewPermission ?? "(unknown kind)"}</code>; your identity does not have it.
            </p>
          ) : null}

          <h3>Execution</h3>
          <dl className="kv">
            <dt>State</dt><dd><ExecutionBadge state={request.execution} /></dd>
            <dt>Attempts</dt><dd>{exec ? exec.attempts : <span className="muted">—</span>}</dd>
            <dt>Provider ref</dt><dd>{exec?.providerRef ? <code>{exec.providerRef}</code> : <span className="muted">—</span>}</dd>
            <dt>Last error</dt><dd>{exec?.lastError ? <span className="danger-text">{exec.lastError}</span> : <span className="muted">—</span>}</dd>
          </dl>
          {request.execution === "NEEDS_REVIEW" ? (
            <div className="alert alert-warn" role="alert">
              <strong>Needs manual review.</strong> The outcome of this refund is unresolved after retries. It has <em>not</em> been confirmed as executed and will not be retried automatically under a new key; reconcile with the provider before acting.
            </div>
          ) : null}
          {request.execution === "SUCCEEDED" ? (
            <div className="alert alert-ok" role="status">
              Refund executed exactly once. Provider reference: <code>{exec?.providerRef ?? "(missing)"}</code>
            </div>
          ) : null}
          {request.decision === "REJECTED" ? <p className="muted">Rejected requests create no execution job.</p> : null}
          {app?.approvedNote && request.decision === "APPROVED" ? (
            <div className="alert alert-ok" role="status">{app.approvedNote}</div>
          ) : null}
        </div>
      </div>

      <AuditTimeline actor={actor} requestId={request.id} refreshKey={auditKey} />
    </section>
  );
}
