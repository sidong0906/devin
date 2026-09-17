import type { AnchorHTMLAttributes, ReactNode } from "react";
import { Box, Text } from "@radix-ui/themes";
import { cx, TONE_COLOR, TONES, type Tone } from "../tone";
import type { SeriesColor } from "./Chart";

export type AppShellProps = {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
};

/** Left navigation rail, sticky header, grey canvas. The canvas is the only place cards sit on a tinted background. */
export function AppShell({ sidebar, header, children }: AppShellProps) {
  return (
    <div className="shell">
      <aside className="shell-sidebar">{sidebar}</aside>
      <div className="shell-main">
        <header className="shell-header">{header}</header>
        <main className="shell-content">{children}</main>
      </div>
    </div>
  );
}

export function Sidebar({ brand, children, footer }: { brand: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <nav className="sidebar" aria-label="Primary">
      <div className="sidebar-brand">{brand}</div>
      <div className="sidebar-items">{children}</div>
      {footer ? <div className="sidebar-footer">{footer}</div> : null}
    </nav>
  );
}

export function NavSection({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="nav-section">
      <Text as="p" size="1" weight="medium" className="nav-section-title">{title}</Text>
      {children}
    </div>
  );
}

export type NavItemProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  active: boolean;
  icon?: ReactNode;
  /** Small count or status shown at the right edge. */
  meta?: ReactNode;
};

export function NavItem({ active, icon, meta, className, children, ...rest }: NavItemProps) {
  return (
    <a className={cx("nav-item", active && "active", className)} {...(active ? { "aria-current": "page" as const } : {})} {...rest}>
      {icon ? <span className="nav-item-icon">{icon}</span> : null}
      <span className="nav-item-label">{children}</span>
      {meta ? <span className="nav-item-meta">{meta}</span> : null}
    </a>
  );
}

export type AppIconColor = Tone | SeriesColor;

const isTone = (c: AppIconColor): c is Tone => (TONES as readonly string[]).includes(c);

/** Turns an app colour into the `tone`/`color` pair chart slices and series accept. */
export function colorProps(color: AppIconColor): { tone: Tone } | { color: SeriesColor } {
  return isTone(color) ? { tone: color } : { color };
}

/** Coloured square behind a glyph: the per-tool identity used in navigation and page headers. */
export function AppIcon({ color, size = "md", children, className }: { color: AppIconColor; size?: "sm" | "md" | "lg"; children: ReactNode; className?: string }) {
  const scale = isTone(color) ? TONE_COLOR[color] : color;
  return (
    <span className={cx("app-icon", `app-icon-${size}`, className)} style={{ background: `var(--${scale}-9)` }} aria-hidden="true">
      {children}
    </span>
  );
}

export type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ title, description, icon, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      {icon}
      <Box className="page-header-text">
        <Text as="p" size="5" weight="bold">{title}</Text>
        {description ? <Text as="p" size="2" className="muted">{description}</Text> : null}
      </Box>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </div>
  );
}
