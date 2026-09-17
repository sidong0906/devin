import type { ComponentProps } from "react";
import { Callout } from "@radix-ui/themes";
import { cx, TONE_COLOR, type Tone } from "../tone";

export type AlertProps = Omit<ComponentProps<typeof Callout.Root>, "color"> & { tone: Tone };

/**
 * Inline message block. `role` defaults to "alert" for warn/danger (announced immediately)
 * and "status" otherwise; pass `role` to override.
 */
export function Alert({ tone, className, role, children, ...rest }: AlertProps) {
  const defaultRole = tone === "warn" || tone === "danger" ? "alert" : "status";
  return (
    <Callout.Root color={TONE_COLOR[tone]} variant="surface" size="1" className={cx("alert", `alert-${tone}`, className)} role={role ?? defaultRole} {...rest}>
      <Callout.Text>{children}</Callout.Text>
    </Callout.Root>
  );
}
