import type { PaymentDto } from "@tools/contracts";
import { formatMoney } from "../../format";
import { refundsMeta } from "./meta";
import { BarsChart, ChartCard, DonutChart, Icons, Meter, StatGrid, StatTile, colorProps, type Slice } from "@tools/ui";

/** Tiles and charts over the payments list. A refund request here means "requested", not "refunded": execution state lives on the request. */
export function RefundsSummary({ payments }: { payments: readonly PaymentDto[] }) {
  const currency = payments[0]?.currency ?? "USD";
  const captured = payments.reduce((n, p) => n + p.amountMinor, 0);
  const requested = payments.filter((p) => p.refundRequestId !== null);
  const requestedMinor = requested.reduce((n, p) => n + p.amountMinor, 0);
  const coverage: Slice[] = [
    { label: "Refund requested", value: requested.length, tone: "pending" },
    { label: "No request", value: payments.length - requested.length, ...colorProps(refundsMeta.color) },
  ];

  return (
    <>
      <StatGrid>
        <StatTile label="Captured volume" value={formatMoney(captured, currency)} tone="neutral" icon={<Icons.ArchiveIcon />} hint={`${payments.length} payments`} />
        <StatTile label="Refunds requested" value={requested.length} tone="pending" icon={<Icons.ReloadIcon />} hint={`${formatMoney(requestedMinor, currency)} awaiting or done`} />
        <StatTile label="Refundable" value={payments.length - requested.length} tone="neutral" icon={<Icons.TokensIcon />} hint="One request per payment" />
        <StatTile label="Largest payment" value={formatMoney(Math.max(0, ...payments.map((p) => p.amountMinor)), currency)} tone="neutral" icon={<Icons.BarChartIcon />} hint="Full refunds only" />
      </StatGrid>
      <div className="dashboard-grid">
        <ChartCard className="span-8" title="Captured amount by payment" description={`${currency}, whole units. Highlighted bars already have a refund request.`}>
          <BarsChart data={payments.map((p) => ({ label: p.id, value: Math.round(p.amountMinor / 100), ...(p.refundRequestId ? { tone: "pending" as const } : colorProps(refundsMeta.color)) }))} tone="neutral" height={200} />
        </ChartCard>
        <ChartCard className="span-4" title="Refund coverage" description="Share of payments with a request on file.">
          <DonutChart data={coverage} centerLabel="payments" height={150} />
          <Meter label="Requested amount" value={Math.round(requestedMinor / 100)} max={Math.round(captured / 100)} tone="pending" caption={`${formatMoney(requestedMinor, currency)} of ${formatMoney(captured, currency)}`} />
        </ChartCard>
      </div>
    </>
  );
}
