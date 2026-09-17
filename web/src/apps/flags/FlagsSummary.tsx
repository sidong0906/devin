import type { FlagDto } from "@tools/contracts";
import { flagsMeta } from "./meta";
import { BarsChart, ChartCard, DonutChart, Icons, Meter, StatGrid, StatTile, colorProps, type Slice } from "@tools/ui";

/** Tiles and a donut over the flag list. "Pending" counts proposals a reviewer has not decided yet. */
export function FlagsSummary({ flags }: { flags: readonly FlagDto[] }) {
  const on = flags.filter((f) => f.value).length;
  const pending = flags.filter((f) => f.pendingRequestId !== null).length;
  const changed = flags.filter((f) => f.version > 0).length;
  const state: Slice[] = [
    { label: "On", value: on, tone: "ok" },
    { label: "Off", value: flags.length - on, tone: "neutral" },
  ];

  return (
    <>
      <StatGrid>
        <StatTile label="Flags" value={flags.length} tone="neutral" icon={<Icons.SwitchIcon />} hint="Seeded keys" />
        <StatTile label="On" value={on} tone="ok" icon={<Icons.CheckCircledIcon />} hint={`${flags.length - on} off`} />
        <StatTile label="Pending changes" value={pending} tone={pending > 0 ? "pending" : "neutral"} icon={<Icons.ClockIcon />} hint="Awaiting a reviewer" />
        <StatTile label="Changed since seed" value={changed} tone="neutral" icon={<Icons.UpdateIcon />} hint="Version above 0" />
      </StatGrid>
      <div className="dashboard-grid">
        <ChartCard className="span-4" title="Flag state" description="Current published values.">
          <DonutChart data={state} centerLabel="flags" height={180} />
        </ChartCard>
        <ChartCard className="span-5" title="Publishes per flag" description="Every approved change increments the version; a stale proposal is refused." >
          <BarsChart data={flags.map((f) => ({ label: f.key, value: f.version, ...(f.pendingRequestId ? { tone: "pending" as const } : colorProps(flagsMeta.color)) }))} layout="horizontal" height={180} emptyText="No flag has been changed yet" />
        </ChartCard>
        <ChartCard className="span-3" title="Review load" description="Proposals a second person still has to decide.">
          <Meter label="Pending proposals" value={pending} max={flags.length} tone={pending > 0 ? "pending" : "neutral"} />
          <Meter label="Changed at least once" value={changed} max={flags.length} tone="ok" />
        </ChartCard>
      </div>
    </>
  );
}
