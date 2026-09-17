import type { AnchorHTMLAttributes, HTMLAttributes } from "react";
import { cx } from "../tone";

export function Tabs({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <nav className={cx("tabs", className)} {...rest} />;
}

export type TabLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { active: boolean };

/** Anchor-based tab; callers own navigation via `onClick` and `href`. */
export function TabLink({ active, className, ...rest }: TabLinkProps) {
  return <a className={cx("tab", active && "active", className)} aria-current={active ? "page" : undefined} {...rest} />;
}
