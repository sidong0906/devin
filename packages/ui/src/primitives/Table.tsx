import type { TableHTMLAttributes } from "react";
import { cx } from "../tone";

export type TableProps = TableHTMLAttributes<HTMLTableElement> & {
  /** Rows navigate somewhere on click; adds hover/focus affordance. Rows must set tabIndex and onKeyDown. */
  clickable?: boolean;
};

/**
 * Data table. Column conventions: `className="num"` on numeric cells (right-aligned, tabular figures),
 * `className="actions"` on the trailing action cell (no wrap).
 */
export function Table({ clickable, className, ...rest }: TableProps) {
  return <table className={cx("table", clickable && "clickable", className)} {...rest} />;
}
