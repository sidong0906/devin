import type { ComponentProps } from "react";
import { TabNav } from "@radix-ui/themes";
import { cx } from "../tone";

export function Tabs({ className, ...rest }: ComponentProps<typeof TabNav.Root>) {
  return <TabNav.Root size="2" my="4" className={cx("tabs", className)} {...rest} />;
}

export type TabLinkProps = ComponentProps<typeof TabNav.Link> & { active: boolean };

/** Anchor-based tab; callers own navigation via `onClick` and `href`. */
export function TabLink({ active, className, ...rest }: TabLinkProps) {
  return <TabNav.Link active={active} className={cx("tab", active && "active", className)} {...rest} />;
}
