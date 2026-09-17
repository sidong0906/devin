import type { ComponentProps, ReactNode } from "react";
import { Box, Flex, Grid, Progress, Text } from "@radix-ui/themes";
import { cx, TONE_COLOR, type Tone } from "../tone";

export type StatTileProps = Omit<ComponentProps<typeof Box>, "children"> & {
  label: ReactNode;
  value: ReactNode;
  /** One line under the value: a comparison, a unit, or what the number excludes. */
  hint?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
};

/**
 * KPI tile: tinted card, coloured icon disc, one big number. The tone follows the same rules as
 * Badge: `ok` only for confirmed outcomes, `warn` for anything a human still has to look at.
 */
export function StatTile({ label, value, hint, tone = "neutral", icon, className, ...rest }: StatTileProps) {
  return (
    <Box className={cx("stat", `stat-${tone}`, className)} data-accent-color={TONE_COLOR[tone]} {...rest}>
      <Flex align="start" justify="between" gap="3">
        <Box>
          <Text as="p" size="1" weight="medium" className="stat-label">{label}</Text>
          <Text as="p" size="7" weight="bold" className="stat-value">{value}</Text>
          {hint ? <Text as="p" size="1" className="stat-hint">{hint}</Text> : null}
        </Box>
        {icon ? <span className="stat-icon" aria-hidden="true">{icon}</span> : null}
      </Flex>
    </Box>
  );
}

/** Auto-fitting row of StatTiles. */
export function StatGrid({ className, ...rest }: ComponentProps<typeof Grid>) {
  return <Grid columns={{ initial: "1", xs: "2", md: "repeat(auto-fit, minmax(190px, 1fr))" }} gap="3" my="3" className={cx("stat-grid", className)} {...rest} />;
}

export type MeterProps = {
  label: ReactNode;
  value: number;
  max: number;
  tone?: Tone;
  /** Right-hand caption; defaults to `value / max`. */
  caption?: ReactNode;
};

/** Labelled progress bar for "x of y" facts (refund rate, flags on). */
export function Meter({ label, value, max, tone = "pending", caption }: MeterProps) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <Box className={cx("meter", `meter-${tone}`)}>
      <Flex justify="between" mb="1">
        <Text size="1" weight="medium">{label}</Text>
        <Text size="1" className="muted">{caption ?? `${value} / ${max}`}</Text>
      </Flex>
      <Progress value={pct} color={TONE_COLOR[tone]} size="2" variant="soft" {...(typeof label === "string" ? { "aria-label": label } : {})} />
    </Box>
  );
}
