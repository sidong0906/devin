import { useCallback, useEffect, useState } from "react";
import type { Actor, ApprovalRequestDto, ExecutionState } from "@tools/contracts";
import { ApiClientError, api } from "../api/client";
import { formatDate } from "../format";
import { DecisionBadge, ExecutionBadge } from "./Badges";
import { ErrorBox } from "./ErrorBox";
import { AuditTimeline } from "./AuditTimeline";
import { appForKind } from "../apps";
import { GenericPayloadFields } from "./GenericPayloadFields";
import { ActionsRow, Alert, Button, Card, CardTitle, ChipGroup, Grid2, KeyValueList, KeyValueRow, Loading, SectionHead } from "@tools/ui";

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
        <Loading>Loading request…</Loading>
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
      <SectionHead heading={<>Request <code>{request.id}</code></>}>
        <ChipGroup>
          <DecisionBadge state={request.decision} />
          <ExecutionBadge state={request.execution} />
          {polling ? <span className="muted small" aria-live="polite">polling every 1s…</span> : null}
        </ChipGroup>
      </SectionHead>
      {loadError ? <ErrorBox error={loadError} prefix="Refresh failed (showing last known state):" /> : null}

      <Grid2>
        <Card>
          <CardTitle>Immutable payload</CardTitle>
          <KeyValueList>
            <KeyValueRow label="Kind"><code>{request.payload.kind}</code></KeyValueRow>
            <PayloadFields payload={request.payload} />
            <KeyValueRow label="Summary">{request.summary}</KeyValueRow>
            <KeyValueRow label="Requested by">{request.requesterName} <span className="muted small">({request.requesterId})</span></KeyValueRow>
            <KeyValueRow label="Created">{formatDate(request.createdAt)}</KeyValueRow>
          </KeyValueList>
        </Card>

        <Card>
          <CardTitle>Decision</CardTitle>
          <KeyValueList>
            <KeyValueRow label="State"><DecisionBadge state={request.decision} /></KeyValueRow>
            <KeyValueRow label="Decided by">{request.decidedById ?? <span className="muted">—</span>}</KeyValueRow>
            <KeyValueRow label="Decided at">{formatDate(request.decidedAt)}</KeyValueRow>
          </KeyValueList>

          {conflict ? (
            <Alert tone="warn" data-testid="conflict">
              <strong>Conflict — already decided.</strong> The server rejected this decision with <code>409 ALREADY_DECIDED</code>: {conflict.message}. The record below has been refreshed to the authoritative state.
            </Alert>
          ) : null}
          {selfApproval ? (
            <Alert tone="danger" data-testid="self-approval">
              <strong>Self-approval blocked (403 SELF_APPROVAL).</strong> You requested this; a different reviewer must decide.
              <div className="muted small">Server: {decideError instanceof Error ? decideError.message : ""}</div>
            </Alert>
          ) : null}
          {decideError && !selfApproval ? <ErrorBox error={decideError} prefix="Decision rejected by server:" /> : null}

          {pending && canReview ? (
            <ActionsRow>
              <Button disabled={deciding !== null} onClick={() => void decide("approve")}>
                {deciding === "approve" ? "Approving…" : "Approve"}
              </Button>
              <Button variant="danger" disabled={deciding !== null} onClick={() => void decide("reject")}>
                {deciding === "reject" ? "Rejecting…" : "Reject"}
              </Button>
              {isRequester ? <span className="muted small">You are the requester — the server will refuse (maker-checker).</span> : null}
            </ActionsRow>
          ) : null}
          {pending && !canReview ? (
            <p className="muted">
              Deciding requires <code>{app?.reviewPermission ?? "(unknown kind)"}</code>; your identity does not have it.
            </p>
          ) : null}

          <CardTitle>Execution</CardTitle>
          <KeyValueList>
            <KeyValueRow label="State"><ExecutionBadge state={request.execution} /></KeyValueRow>
            <KeyValueRow label="Attempts">{exec ? exec.attempts : <span className="muted">—</span>}</KeyValueRow>
            <KeyValueRow label="Provider ref">{exec?.providerRef ? <code>{exec.providerRef}</code> : <span className="muted">—</span>}</KeyValueRow>
            <KeyValueRow label="Last error">{exec?.lastError ? <span className="danger-text">{exec.lastError}</span> : <span className="muted">—</span>}</KeyValueRow>
          </KeyValueList>
          {request.execution === "NEEDS_REVIEW" ? (
            <Alert tone="warn">
              <strong>Needs manual review.</strong> The outcome of this request is unresolved after retries. It has <em>not</em> been confirmed as executed and will not be retried automatically under a new key; reconcile with the provider before acting.
            </Alert>
          ) : null}
          {request.execution === "SUCCEEDED" ? (
            <Alert tone="ok">
              Executed exactly once. Provider reference: <code>{exec?.providerRef ?? "(missing)"}</code>
            </Alert>
          ) : null}
          {request.decision === "REJECTED" ? <p className="muted">Rejected requests create no execution job.</p> : null}
          {app?.approvedNote && request.decision === "APPROVED" ? (
            <Alert tone="ok">{app.approvedNote}</Alert>
          ) : null}
        </Card>
      </Grid2>

      <AuditTimeline actor={actor} requestId={request.id} refreshKey={auditKey} />
    </section>
  );
}
