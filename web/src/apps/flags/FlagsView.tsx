import { useCallback, useEffect, useState } from "react";
import type { Actor, FlagDto } from "@tools/contracts";
import { ApiClientError, api } from "../../api/client";
import { formatDate } from "../../format";
import { ErrorBox } from "../../platform/ErrorBox";
import { requestHref } from "../../hrefs";
import { Alert, Badge, Button, EmptyState, Loading, SectionHead, Table } from "@tools/ui";

type Props = { actor: Actor; onNavigate: (hash: string) => void };

export function FlagsView({ actor, onNavigate }: Props) {
  const [flags, setFlags] = useState<FlagDto[] | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<{ key: string; error: unknown } | null>(null);
  const [success, setSuccess] = useState<{ key: string; requestId: string } | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await api.flags();
      setFlags(res.flags);
    } catch (e) {
      setLoadError(e);
      setFlags(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, actor.id]);

  const canPropose = actor.permissions.includes("flags.propose");

  async function propose(flag: FlagDto) {
    setSubmitting(flag.key);
    setActionError(null);
    setSuccess(null);
    try {
      const res = await api.proposeFlag(flag.key, flag.version, !flag.value);
      setSuccess({ key: flag.key, requestId: res.requestId });
      await load();
    } catch (e) {
      setActionError({ key: flag.key, error: e });
      if (e instanceof ApiClientError && (e.code === "STALE_VERSION" || e.code === "DUPLICATE_REQUEST")) await load();
    } finally {
      setSubmitting(null);
    }
  }

  const link = (id: string) => (
    <a href={requestHref(id)} onClick={(e) => { e.preventDefault(); onNavigate(requestHref(id)); }}>
      {id}
    </a>
  );

  const stale = actionError?.error instanceof ApiClientError && actionError.error.code === "STALE_VERSION" ? actionError.error : null;
  const duplicate = actionError?.error instanceof ApiClientError && actionError.error.code === "DUPLICATE_REQUEST" ? actionError.error : null;
  const duplicatePending = duplicate ? flags?.find((f) => f.key === actionError?.key)?.pendingRequestId ?? null : null;

  return (
    <section>
      <SectionHead heading="Feature flags">
        <Button variant="secondary" onClick={() => void load()} disabled={flags === null && !loadError}>
          Refresh
        </Button>
      </SectionHead>
      {!canPropose ? <p className="muted">You can view flags but cannot propose changes (requires <code>flags.propose</code>).</p> : null}
      {loadError ? <ErrorBox error={loadError} prefix="Could not load flags:" /> : null}
      {flags === null && !loadError ? <Loading>Loading flags…</Loading> : null}
      {flags && flags.length === 0 ? <EmptyState>No flags seeded.</EmptyState> : null}
      {success ? (
        <Alert tone="ok">
          Change to <code>{success.key}</code> proposed as {link(success.requestId)}. It now awaits an independent reviewer; the flag stays unchanged until approved.
        </Alert>
      ) : null}
      {stale ? (
        <Alert tone="warn" data-testid="stale-version">
          <strong>Flag changed since you loaded it — refresh.</strong> The server rejected the proposal with <code>409 STALE_VERSION</code>: {stale.message}. The table below has been refreshed with the current version.
        </Alert>
      ) : null}
      {duplicate ? (
        <Alert tone="warn" data-testid="duplicate-request">
          <strong>A change is already pending for this flag version</strong> (<code>409 DUPLICATE_REQUEST</code>).{" "}
          {duplicatePending ? <>See pending request {link(duplicatePending)}.</> : duplicate.message}
        </Alert>
      ) : null}
      {actionError && !stale && !duplicate ? <ErrorBox error={actionError.error} prefix={`Proposal for ${actionError.key} rejected by server:`} /> : null}
      {flags && flags.length > 0 ? (
        <Table>
          <thead>
            <tr>
              <th>Flag</th>
              <th>Value</th>
              <th className="num">Version</th>
              <th>Updated by</th>
              <th>Updated at</th>
              <th>Pending change</th>
              {canPropose ? <th></th> : null}
            </tr>
          </thead>
          <tbody>
            {flags.map((f) => {
              const pending = f.pendingRequestId !== null;
              return (
                <tr key={f.key}>
                  <td><code>{f.key}</code></td>
                  <td><Badge tone={f.value ? "ok" : "neutral"}>{f.value ? "on" : "off"}</Badge></td>
                  <td className="num">v{f.version}</td>
                  <td>{f.updatedById ?? <span className="muted">seed</span>}</td>
                  <td>{formatDate(f.updatedAt)}</td>
                  <td>{f.pendingRequestId ? link(f.pendingRequestId) : <span className="muted">none</span>}</td>
                  {canPropose ? (
                    <td className="actions">
                      <Button
                        disabled={pending || submitting !== null}
                        title={pending ? "A change is already pending for this flag version" : `Propose setting ${f.key} to ${!f.value} (expects v${f.version})`}
                        onClick={() => void propose(f)}
                      >
                        {submitting === f.key ? "Proposing…" : `Propose ${f.value ? "off" : "on"}`}
                      </Button>
                      {pending ? <div className="muted small">Awaiting review</div> : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </Table>
      ) : null}
    </section>
  );
}
