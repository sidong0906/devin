import type { ComponentProps } from "react";
import { Button as RButton, Flex } from "@radix-ui/themes";
import { cx } from "../tone";

export type ButtonVariant = "primary" | "secondary" | "danger";

export type ButtonProps = Omit<ComponentProps<typeof RButton>, "variant" | "color"> & {
  variant?: ButtonVariant;
  /** For secondary buttons used as a toggle/filter; also sets `aria-pressed`. */
  active?: boolean;
};

type RadixVariant = NonNullable<ComponentProps<typeof RButton>["variant"]>;

const VARIANT: Record<ButtonVariant, { radix: RadixVariant; color?: "red"; className: string | null }> = {
  primary: { radix: "solid", className: null },
  secondary: { radix: "surface", className: "btn-secondary" },
  danger: { radix: "solid", color: "red", className: "btn-danger" },
};

export function Button({ variant = "primary", active, className, type = "button", ...rest }: ButtonProps) {
  const v = VARIANT[variant];
  return (
    <RButton
      type={type}
      size="2"
      variant={active ? "soft" : v.radix}
      {...(v.color ? { color: v.color } : {})}
      className={cx("btn", v.className, active && "active", className)}
      {...(active === undefined ? {} : { "aria-pressed": active })}
      {...rest}
    />
  );
}

/** Horizontal row of actions under a card or form. */
export function ActionsRow({ className, ...rest }: ComponentProps<typeof Flex>) {
  return <Flex gap="2" align="center" wrap="wrap" my="3" className={cx("actions-row", className)} {...rest} />;
}

/** Tight group of related buttons, e.g. filters. */
export function ButtonGroup({ className, ...rest }: ComponentProps<typeof Flex>) {
  return <Flex gap="1" role="group" className={cx("button-group", className)} {...rest} />;
}
