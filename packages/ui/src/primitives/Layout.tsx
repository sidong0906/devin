import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../tone";

/** White bordered container for one concern (payload, decision, timeline). */
export function Card({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={cx("card", className)} {...rest} />;
}

/** Two equal columns; collapses to one below 900px. */
export function Grid2({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("grid-2", className)} {...rest} />;
}

/** Heading row with optional right-aligned controls. */
export function SectionHead({ heading, children, className, ...rest }: HTMLAttributes<HTMLDivElement> & { heading: ReactNode }) {
  return (
    <div className={cx("section-head", className)} {...rest}>
      <h2>{heading}</h2>
      {children}
    </div>
  );
}

/** Dashed placeholder for "nothing here". */
export function EmptyState({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cx("empty", className)} {...rest} />;
}

/** Muted one-liner while data is loading; use in place of spinners. */
export function Loading({ children = "Loading…" }: { children?: ReactNode }) {
  return <p className="muted">{children}</p>;
}
