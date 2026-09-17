import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { cx } from "../tone";

export type ButtonVariant = "primary" | "secondary" | "danger";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  /** For secondary buttons used as a toggle/filter; also sets `aria-pressed`. */
  active?: boolean;
};

const VARIANT_CLASS: Record<ButtonVariant, string | null> = { primary: null, secondary: "btn-secondary", danger: "btn-danger" };

export function Button({ variant = "primary", active, className, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx("btn", VARIANT_CLASS[variant], active && "active", className)}
      {...(active === undefined ? {} : { "aria-pressed": active })}
      {...rest}
    />
  );
}

/** Horizontal row of actions under a card or form. */
export function ActionsRow({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("actions-row", className)} {...rest} />;
}

/** Tight group of related buttons, e.g. filters. */
export function ButtonGroup({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("button-group", className)} role="group" {...rest} />;
}
