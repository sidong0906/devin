import { useCallback, useEffect, useState } from "react";
import type { Actor, ApprovalRequestDto } from "@tools/contracts";
import { api } from "../api/client";
import { formatDate } from "../format";
import { DecisionBadge, ExecutionBadge } from "../components/Badges";
import { ErrorBox } from "../components/ErrorBox";
import { requestHref } from "../hrefs";

type Filter = "pending" | "decided" | "all";
type Props = { actor: Actor; onNavigate: (hash: string) => void };

export function ApprovalsQueue({ actor, onNavigate }: Props) {
  const [requests, setRequests] = useState<ApprovalRequestDto[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [filter, setFilter] = useState<Filter>("pending");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.approvals();
      setRequests(res.requests);
    } catch (e) {
      setError(e);
      setRequests(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, actor.id]);

  const visible = (requests ?? []).filter((r) =>
    filter === "all" ? true : filter === "pending" ? r.decision === "PENDING" : r.decision !== "PENDING",
  );

  return (
    <section>
      <div className="section-head">
        <h2>Approvals queue</h2>
        <div className="filters" role="group" aria-label="Filter">
          {(["pending", "decided", "all"] as Filter[]).map((f) => (
            <button key={f} className={`btn btn-secondary ${filter === f ? "active" : ""}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
          <button className="btn btn-secondary" onClick={() => void load()}>Refresh</button>
        </div>
      </div>
      {error ? <ErrorBox error={error} prefix="Could not load approvals:" /> : null}
      {requests === null && !error ? <p className="muted">Loading approvals…</p> : null}
      {requests && visible.length === 0 ? <p className="empty">No {filter === "all" ? "" : filter + " "}requests.</p> : null}
      {visible.length > 0 ? (
        <table className="table clickable">
          <thead>
            <tr>
              <th>Request</th>
              <th>Kind</th>
              <th>Summary</th>
              <th>Requester</th>
              <th>Decision</th>
              <th>Execution</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} tabIndex={0} onClick={() => onNavigate(requestHref(r.id))} onKeyDown={(e) => { if (e.key === "Enter") onNavigate(requestHref(r.id)); }}>
                <td><a href={requestHref(r.id)} onClick={(e) => e.preventDefault()}>{r.id}</a></td>
                <td><code>{r.kind}</code></td>
                <td>{r.summary}</td>
                <td>{r.requesterName} <span className="muted small">({r.requesterId})</span></td>
                <td><DecisionBadge state={r.decision} /></td>
                <td><ExecutionBadge state={r.execution} /></td>
                <td>{formatDate(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
