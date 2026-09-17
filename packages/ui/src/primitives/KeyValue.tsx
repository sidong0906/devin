import type { ComponentProps, ReactNode } from "react";
import { DataList } from "@radix-ui/themes";
import { cx } from "../tone";

/** Label/value list. Children must be `<KeyValueRow>`s (apps' `PayloadFields` render these). */
export function KeyValueList({ className, ...rest }: ComponentProps<typeof DataList.Root>) {
  return <DataList.Root size="2" className={cx("kv", className)} {...rest} />;
}

export function KeyValueRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <DataList.Item>
      <DataList.Label minWidth="120px">{label}</DataList.Label>
      <DataList.Value>{children}</DataList.Value>
    </DataList.Item>
  );
}
