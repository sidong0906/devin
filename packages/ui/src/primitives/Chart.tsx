import type { ReactNode } from "react";
import { Box, Flex, Text } from "@radix-ui/themes";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cx, TONE_COLOR, type Tone } from "../tone";

/** Radix colour scales used for categorical series, in the order they are assigned. */
export const CHART_SERIES = ["indigo", "teal", "amber", "crimson", "grass", "violet", "orange", "cyan"] as const;
export type SeriesColor = (typeof CHART_SERIES)[number];

/** Solid step-9 of a Radix scale, resolved by the theme so charts follow light/dark and accent changes. */
export const scaleFill = (scale: string) => `var(--${scale}-9)`;
export const toneFill = (tone: Tone) => scaleFill(TONE_COLOR[tone]);
export const seriesFill = (i: number) => scaleFill(CHART_SERIES[i % CHART_SERIES.length] as SeriesColor);

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "var(--color-panel-solid)",
    border: "1px solid var(--gray-6)",
    borderRadius: "var(--radius-3)",
    fontSize: "var(--font-size-1)",
    color: "var(--gray-12)",
  },
  labelStyle: { color: "var(--gray-11)", marginBottom: 4 },
  cursor: { fill: "var(--gray-3)" },
} as const;

const AXIS = { stroke: "var(--gray-8)", fontSize: 11, tickLine: false as const, axisLine: false as const };

export type ChartCardProps = {
  title: ReactNode;
  /** One sentence on what the chart counts and what it leaves out. */
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Card frame for one chart or widget. Charts are decorative summaries: the tables underneath remain the record. */
export function ChartCard({ title, description, actions, children, className }: ChartCardProps) {
  return (
    <Box className={cx("chart-card", className)}>
      <Flex justify="between" align="start" gap="3" mb="2">
        <Box>
          <Text as="p" size="2" weight="bold">{title}</Text>
          {description ? <Text as="p" size="1" className="muted">{description}</Text> : null}
        </Box>
        {actions}
      </Flex>
      {children}
    </Box>
  );
}

export type Slice = { label: string; value: number; tone?: Tone; color?: SeriesColor };

const sliceFill = (s: Slice, i: number) => (s.tone ? toneFill(s.tone) : s.color ? scaleFill(s.color) : seriesFill(i));

export type DonutChartProps = {
  data: readonly Slice[];
  height?: number;
  /** Big number in the hole; defaults to the sum. */
  center?: ReactNode;
  centerLabel?: ReactNode;
  emptyText?: string;
};

export function DonutChart({ data, height = 220, center, centerLabel, emptyText = "No data yet" }: DonutChartProps) {
  const total = data.reduce((n, d) => n + d.value, 0);
  if (total === 0) return <ChartEmpty height={height}>{emptyText}</ChartEmpty>;
  return (
    <Box className="chart donut" style={{ height }} role="img" aria-label={data.map((d) => `${d.label}: ${d.value}`).join(", ")}>
      <PieChart responsive style={{ width: "100%", height: "100%" }}>
        <Pie data={data as Slice[]} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="88%" paddingAngle={2} stroke="var(--color-panel-solid)" isAnimationActive={false}>
          {data.map((s, i) => (
            <Cell key={s.label} fill={sliceFill(s, i)} />
          ))}
        </Pie>
        <Tooltip {...TOOLTIP_STYLE} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "var(--font-size-1)" }} />
      </PieChart>
      <div className="donut-center">
        <Text as="p" size="6" weight="bold">{center ?? total}</Text>
        {centerLabel ? <Text as="p" size="1" className="muted">{centerLabel}</Text> : null}
      </div>
    </Box>
  );
}

export type BarsChartProps = {
  data: readonly Slice[];
  height?: number;
  /** Bar colour when a datum has no tone/color of its own. */
  tone?: Tone;
  layout?: "vertical" | "horizontal";
  emptyText?: string;
};

/** One bar per category. `layout="horizontal"` puts the labels on the y-axis (good for long names). */
export function BarsChart({ data, height = 220, tone = "pending", layout = "vertical", emptyText = "No data yet" }: BarsChartProps) {
  if (data.every((d) => d.value === 0)) return <ChartEmpty height={height}>{emptyText}</ChartEmpty>;
  const horizontal = layout === "horizontal";
  return (
    <Box className="chart bars" style={{ height }} role="img" aria-label={data.map((d) => `${d.label}: ${d.value}`).join(", ")}>
      <BarChart responsive style={{ width: "100%", height: "100%" }} data={data as Slice[]} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 8, left: horizontal ? 8 : -16, bottom: 0 }}>
        <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke="var(--gray-5)" strokeDasharray="3 3" />
        {horizontal ? <XAxis type="number" allowDecimals={false} {...AXIS} /> : <XAxis dataKey="label" {...AXIS} />}
        {horizontal ? <YAxis type="category" dataKey="label" width={Math.min(200, 8 + 6.5 * Math.max(...data.map((d) => d.label.length)))} interval={0} {...AXIS} /> : <YAxis allowDecimals={false} {...AXIS} />}
        <Tooltip {...TOOLTIP_STYLE} />
        <Bar dataKey="value" radius={4} isAnimationActive={false} fill={toneFill(tone)}>
          {data.map((s, i) => (
            <Cell key={s.label} fill={s.tone || s.color ? sliceFill(s, i) : toneFill(tone)} />
          ))}
        </Bar>
      </BarChart>
    </Box>
  );
}

export type Series = { key: string; label: string; tone?: Tone; color?: SeriesColor };
export type TrendPoint = { label: string } & Record<string, string | number>;

export type TrendChartProps = {
  data: readonly TrendPoint[];
  series: readonly Series[];
  height?: number;
  stacked?: boolean;
  emptyText?: string;
};

/** Stacked area over an ordered axis (days, weeks). Each series is one Radix scale. */
export function TrendChart({ data, series, height = 220, stacked = true, emptyText = "No data yet" }: TrendChartProps) {
  const empty = data.every((p) => series.every((s) => Number(p[s.key] ?? 0) === 0));
  if (empty) return <ChartEmpty height={height}>{emptyText}</ChartEmpty>;
  return (
    <Box className="chart trend" style={{ height }} role="img" aria-label={series.map((s) => s.label).join(", ")}>
      <AreaChart responsive style={{ width: "100%", height: "100%" }} data={data as TrendPoint[]} margin={{ top: 8, right: 20, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--gray-5)" strokeDasharray="3 3" />
        <XAxis dataKey="label" {...AXIS} />
        <YAxis allowDecimals={false} {...AXIS} />
        <Tooltip {...TOOLTIP_STYLE} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "var(--font-size-1)" }} />
        {series.map((s, i) => {
          const fill = s.tone ? toneFill(s.tone) : s.color ? scaleFill(s.color) : seriesFill(i);
          return (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} {...(stacked ? { stackId: "a" } : {})} stroke={fill} fill={fill} fillOpacity={0.25} strokeWidth={2} isAnimationActive={false} />
          );
        })}
      </AreaChart>
    </Box>
  );
}

function ChartEmpty({ height, children }: { height: number; children: ReactNode }) {
  return (
    <Flex align="center" justify="center" className="chart chart-empty muted" style={{ height }}>
      <Text size="1">{children}</Text>
    </Flex>
  );
}
