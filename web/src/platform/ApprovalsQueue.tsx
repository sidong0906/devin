import { useCallback, useEffect, useState } from "react";
import type { Actor, ApprovalRequestDto } from "@tools/contracts";
import { api } from "../api/client";
import { formatDate } from "../format";
import { DecisionBadge, ExecutionBadge } from "./Badges";
import { ErrorBox } from "./ErrorBox";
import { requestHref } from "../hrefs";
import { Button, ButtonGroup, EmptyState, Loading, SectionHead, Table } from "@tools/ui";

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
      <SectionHead heading="Approvals queue">
        <ButtonGroup aria-label="Filter">
          {(["pending", "decided", "all"] as Filter[]).map((f) => (
            <Button key={f} variant="secondary" active={filter === f} onClick={() => setFilter(f)}>
              {f}
            </Button>
          ))}
          <Button variant="secondary" onClick={() => void load()}>Refresh</Button>
        </ButtonGroup>
      </SectionHead>
      {error ? <ErrorBox error={error} prefix="Could not load approvals:" /> : null}
      {requests === null && !error ? <Loading>Loading approvals…</Loading> : null}
      {requests && visible.length === 0 ? <EmptyState>No {filter === "all" ? "" : filter + " "}requests.</EmptyState> : null}
      {visible.length > 0 ? (
        <Table clickable>
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
        </Table>
      ) : null}
    </section>
  );
}
