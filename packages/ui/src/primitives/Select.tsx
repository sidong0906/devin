import type { SelectHTMLAttributes } from "react";
import { cx } from "../tone";

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx("select", className)} {...rest} />;
}
