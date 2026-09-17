import type { ComponentProps } from "react";
import { Badge as RBadge, Code, Flex } from "@radix-ui/themes";
import { cx, TONE_COLOR, type Tone } from "../tone";

export type BadgeProps = Omit<ComponentProps<typeof RBadge>, "color" | "variant"> & { tone: Tone };

/** Compact status pill. Pair with `title` for the long explanation and `data-state` for tests. */
export function Badge({ tone, className, ...rest }: BadgeProps) {
  return <RBadge color={TONE_COLOR[tone]} variant="soft" className={cx("badge", `badge-${tone}`, className)} {...rest} />;
}

/** Monospace pill for identifiers such as permissions or keys. */
export function Chip({ className, ...rest }: Omit<ComponentProps<typeof Code>, "color" | "variant">) {
  return <Code variant="soft" size="1" className={cx("chip", className)} {...rest} />;
}

export function ChipGroup({ className, ...rest }: ComponentProps<typeof Flex>) {
  return <Flex display="inline-flex" gap="1" wrap="wrap" align="center" className={cx("chips", className)} {...rest} />;
}
