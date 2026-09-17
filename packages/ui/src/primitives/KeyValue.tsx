import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../tone";

/** Two-column label/value list. Compose with `<KV.Row>` or with raw `<dt>/<dd>` pairs. */
export function KeyValueList({ className, ...rest }: HTMLAttributes<HTMLDListElement>) {
  return <dl className={cx("kv", className)} {...rest} />;
}

export function KeyValueRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}
