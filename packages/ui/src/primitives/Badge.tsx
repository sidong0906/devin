import type { HTMLAttributes } from "react";
import { cx, type Tone } from "../tone";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & { tone: Tone };

/** Compact status pill. Pair with `title` for the long explanation. */
export function Badge({ tone, className, ...rest }: BadgeProps) {
  return <span className={cx("badge", `badge-${tone}`, className)} {...rest} />;
}

/** Monospace pill for identifiers such as permissions or keys. */
export function Chip({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx("chip", className)} {...rest} />;
}

export function ChipGroup({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx("chips", className)} {...rest} />;
}
