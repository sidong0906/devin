import type { ComponentProps } from "react";
import { Table as RTable } from "@radix-ui/themes";
import { cx } from "../tone";

export type TableProps = ComponentProps<typeof RTable.Root> & {
  /** Rows navigate somewhere on click; adds hover/focus affordance. Rows must set tabIndex and onKeyDown. */
  clickable?: boolean;
};

function Root({ clickable, className, ...rest }: TableProps) {
  return <RTable.Root variant="surface" size="1" className={cx("table", clickable && "clickable", className)} {...rest} />;
}

/**
 * Data table. `<Table.Root>` → `<Table.Head>`/`<Table.Body>` → `<Table.Row>` → `<Table.Th>`/`<Table.Td>`.
 * Cell conventions: `className="num"` on numeric cells (right-aligned, tabular figures),
 * `className="actions"` on the trailing action cell (no wrap).
 */
export const Table = {
  Root,
  Head: RTable.Header,
  Body: RTable.Body,
  Row: RTable.Row,
  Th: RTable.ColumnHeaderCell,
  Td: RTable.Cell,
};
