import { useCallback, useEffect, useState } from "react";
import type { Actor, ApprovalRequestDto, RequestKind } from "@tools/contracts";
import { api } from "../api/client";
import { formatDate } from "../format";
import { WEB_APPS, appForKind } from "../apps";
import { APPROVALS_HREF, requestHref } from "../hrefs";
import { DecisionBadge, ExecutionBadge } from "./Badges";
import { ErrorBox } from "./ErrorBox";
import { countBy, countRequests, decisionSlices, executionSlices, medianDecisionMinutes, newestFirst, requesterSlices, requestsPerDay } from "./metrics";
import {
  AppIcon,
  BarsChart,
  Button,
  ButtonGroup,
  ChartCard,
  colorProps,
  DonutChart,
  EmptyState,
  Icons,
  Loading,
  Meter,
  PageHeader,
  StatGrid,
  StatTile,
  Table,
  TrendChart,
  type Series,
  type Slice,
} from "@tools/ui";

type Props = { actor: Actor; onNavigate: (hash: string) => void };

/** `"all"` or one tool's request kind. */
type ToolFilter = "all" | RequestKind;

const TREND_DAYS = 14;

/** Cross-tool landing page: counts and charts over the approvals list, plus the newest requests. Everything here is derived from `GET /api/approvals`. */
export function Overview({ actor, onNavigate }: Props) {
  const [requests, setRequests] = useState<ApprovalRequestDto[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [filter, setFilter] = useState<ToolFilter>("all");

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

  const go = (hash: string) => (e: { preventDefault: () => void }) => {
    e.preventDefault();
    onNavigate(hash);
  };

  const selectedApp = filter === "all" ? undefined : appForKind(filter);
  const visible = requests === null ? null : filter === "all" ? requests : requests.filter((r) => r.kind === filter);
  const scope = selectedApp ? selectedApp.tab.label : `all ${WEB_APPS.length} tools`;

  return (
    <section>
      <PageHeader
        icon={<AppIcon color="pending" size="lg"><Icons.DashboardIcon /></AppIcon>}
        title="Overview"
        description={`Governed requests for ${scope}, as ${actor.displayName}. Numbers come from the same approvals list the queue shows.`}
        actions={
          <ButtonGroup aria-label="Tool">
            <Button variant="secondary" active={filter === "all"} onClick={() => setFilter("all")}>All tools</Button>
            {WEB_APPS.map((app) => (
              <Button key={app.kind} variant="secondary" active={filter === app.kind} onClick={() => setFilter(app.kind)}>
                {app.tab.label}
              </Button>
            ))}
            <Button variant="secondary" onClick={() => void load()}>Refresh</Button>
          </ButtonGroup>
        }
      />
      {error ? <ErrorBox error={error} prefix="Could not load approvals:" /> : null}
      {visible === null && !error ? <Loading>Loading overview…</Loading> : null}
      {visible ? <Dashboard requests={visible} filter={filter} onNavigate={onNavigate} go={go} /> : null}
    </section>
  );
}

function Dashboard({ requests, filter, onNavigate, go }: { requests: ApprovalRequestDto[]; filter: ToolFilter; onNavigate: (hash: string) => void; go: (hash: string) => (e: { preventDefault: () => void }) => void }) {
  const apps = filter === "all" ? WEB_APPS : WEB_APPS.filter((a) => a.kind === filter);
  const c = countRequests(requests);
  const median = medianDecisionMinutes(requests);
  const byKind = countBy(requests, (r) => r.kind);
  const kindSlices: Slice[] = apps.map((app) => ({ label: app.tab.label, value: byKind.get(app.kind) ?? 0, ...colorProps(app.color) }));
  const series: Series[] = apps.map((app) => ({ key: app.kind, label: app.tab.label, ...colorProps(app.color) }));
  const recent = newestFirst(requests).slice(0, 8);
  const publishesInApproval = apps.length > 0 && apps.every((a) => a.approvedNote !== null);

  return (
    <>
      <StatGrid>
        <StatTile label="Awaiting approval" value={c.pending} tone="pending" icon={<Icons.ClockIcon />} hint="Need a second person" />
        <StatTile label="Approved" value={c.approved} tone="ok" icon={<Icons.CheckCircledIcon />} hint={median === null ? "No decisions yet" : `Median ${median} min to decide`} />
        <StatTile label="Rejected" value={c.rejected} tone="danger" icon={<Icons.CrossCircledIcon />} hint="Refused by a reviewer" />
        {publishesInApproval ? (
          <StatTile label="Published" value={c.approved} tone="ok" icon={<Icons.RocketIcon />} hint="Applied inside the approval" />
        ) : (
          <>
            <StatTile label="Executed" value={c.succeeded} tone="ok" icon={<Icons.RocketIcon />} hint="Provider confirmed once" />
            <StatTile label="Needs review" value={c.needsReview} tone={c.needsReview > 0 ? "warn" : "neutral"} icon={<Icons.ExclamationTriangleIcon />} hint="Unresolved after retries" />
          </>
        )}
      </StatGrid>

      <div className="dashboard-grid">
        <ChartCard className="span-8" title={`Requests per day, last ${TREND_DAYS} days`} description="Created date in UTC, one colour per tool.">
          <TrendChart data={requestsPerDay(requests, apps.map((a) => a.kind), TREND_DAYS)} series={series} height={240} />
        </ChartCard>
        <ChartCard className="span-4" title="Decision outcomes" description="Every request ever created, by current decision.">
          <DonutChart data={decisionSlices(requests)} centerLabel="requests" height={240} />
        </ChartCard>
        {filter === "all" ? (
          <ChartCard className="span-4" title="Requests by tool" description="Which tools generate the approval load.">
            <DonutChart data={kindSlices} centerLabel="requests" height={220} />
          </ChartCard>
        ) : (
          <ChartCard className="span-4" title="Requests by requester" description="Who raises requests in this tool.">
            <DonutChart data={requesterSlices(requests)} centerLabel="requests" height={220} />
          </ChartCard>
        )}
        <ChartCard className="span-4" title="Execution pipeline" description="Approved requests with a job. Flags publish inside the approval, so they never appear here.">
          {publishesInApproval ? (
            <EmptyState>This tool publishes inside the approval transaction; there is no worker job to track.</EmptyState>
          ) : (
            <BarsChart data={executionSlices(requests)} layout="horizontal" height={220} />
          )}
        </ChartCard>
        <ChartCard className="span-4" title="Throughput" description="Share of requests that reached each stage.">
          <Meter label="Decided" value={c.approved + c.rejected} max={c.total} tone="pending" />
          <Meter label="Approved" value={c.approved} max={c.total} tone="ok" />
          {publishesInApproval ? null : (
            <>
              <Meter label="Executed" value={c.succeeded} max={c.approved} tone="ok" caption={`${c.succeeded} / ${c.approved} approved`} />
              <Meter label="Needs review" value={c.needsReview} max={c.approved} tone={c.needsReview > 0 ? "warn" : "neutral"} caption={`${c.needsReview} / ${c.approved} approved`} />
            </>
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="Recent requests"
        description="Newest first. Open a row for payload, decision and audit trail."
        actions={<Button variant="secondary" onClick={go(APPROVALS_HREF)}>Open approvals queue</Button>}
      >
        {recent.length === 0 ? (
          <EmptyState>{filter === "all" ? "No requests yet. Request a refund or propose a flag change to see activity here." : "No requests for this tool yet."}</EmptyState>
        ) : (
          <Table.Root className="clickable" data-testid="recent-requests">
            <Table.Head>
              <Table.Row>
                <Table.Th>Tool</Table.Th>
                <Table.Th>Summary</Table.Th>
                <Table.Th>Requester</Table.Th>
                <Table.Th>Decision</Table.Th>
                <Table.Th>Execution</Table.Th>
                <Table.Th>Created</Table.Th>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {recent.map((r) => {
                const app = appForKind(r.kind);
                return (
                  <Table.Row key={r.id} tabIndex={0} onClick={() => onNavigate(requestHref(r.id))} onKeyDown={(e) => { if (e.key === "Enter") onNavigate(requestHref(r.id)); }}>
                    <Table.Td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        {app ? <AppIcon color={app.color} size="sm">{app.icon}</AppIcon> : null}
                        {app?.tab.label ?? r.kind}
                      </span>
                    </Table.Td>
                    <Table.Td>{r.summary}</Table.Td>
                    <Table.Td>{r.requesterName}</Table.Td>
                    <Table.Td><DecisionBadge state={r.decision} /></Table.Td>
                    <Table.Td><ExecutionBadge state={r.execution} /></Table.Td>
                    <Table.Td className="small muted">{formatDate(r.createdAt)}</Table.Td>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        )}
      </ChartCard>
    </>
  );
}
