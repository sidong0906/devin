import type { HTMLAttributes } from "react";
import { cx, type Tone } from "../tone";

export type AlertProps = HTMLAttributes<HTMLDivElement> & { tone: Tone };

/**
 * Inline message block. `role` defaults to "alert" for warn/danger (announced immediately)
 * and "status" otherwise; pass `role` to override.
 */
export function Alert({ tone, className, role, ...rest }: AlertProps) {
  const defaultRole = tone === "warn" || tone === "danger" ? "alert" : "status";
  return <div className={cx("alert", `alert-${tone}`, className)} role={role ?? defaultRole} {...rest} />;
}
