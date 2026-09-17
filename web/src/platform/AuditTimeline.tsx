import { useEffect, useState } from "react";
import type { Actor, AuditEventDto } from "@tools/contracts";
import { api } from "../api/client";
import { formatDate } from "../format";
import { ErrorBox } from "./ErrorBox";
import { OutcomeBadge } from "./Badges";
import { Card, CardTitle, EmptyState, Loading } from "@tools/ui";

type Props = { actor: Actor; requestId: string; refreshKey: number };

export function AuditTimeline({ actor, requestId, refreshKey }: Props) {
  const canRead = actor.permissions.includes("audit.read");
  const [events, setEvents] = useState<AuditEventDto[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!canRead) return;
    let cancelled = false;
    setError(null);
    api
      .audit(requestId)
      .then((res) => {
        if (!cancelled) setEvents([...res.events].sort((a, b) => a.id - b.id));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e);
      });
    return () => {
      cancelled = true;
    };
  }, [canRead, requestId, refreshKey, actor.id]);

  return (
    <Card>
      <CardTitle>Audit timeline</CardTitle>
      {!canRead ? (
        <p className="muted">
          <code>audit.read</code> required — switch to an identity with that permission to view the append-only event log.
        </p>
      ) : null}
      {canRead && error ? <ErrorBox error={error} prefix="Could not load audit events:" /> : null}
      {canRead && !error && events === null ? <Loading>Loading audit events…</Loading> : null}
      {canRead && events && events.length === 0 ? <EmptyState>No audit events recorded for this request.</EmptyState> : null}
      {canRead && events && events.length > 0 ? (
        <ol className="timeline">
          {events.map((e) => (
            <li key={e.id} className={`timeline-item outcome-${e.outcome}`}>
              <div className="timeline-meta">
                <span className="mono">{formatDate(e.at)}</span>
                <OutcomeBadge outcome={e.outcome} />
              </div>
              <div>
                <code>{e.action}</code> by <strong>{e.actorId}</strong>
              </div>
              <div className="muted">{e.summary}</div>
            </li>
          ))}
        </ol>
      ) : null}
    </Card>
  );
}
