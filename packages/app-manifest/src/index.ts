// The one place a new internal tool is wired in. `services/api` and `services/worker` compose from this list;
// neither imports an app directly. Adding an app = one line here plus its migration and contract entries.
import type { AppModule, Executor } from "@tools/server-core";
import { refundsApp } from "@tools/refunds-server";
import { flagsApp } from "@tools/flags-server";

export const APPS: readonly AppModule[] = [refundsApp, flagsApp];

export function executorsByKind(apps: readonly AppModule[] = APPS): Map<string, Executor> {
  const map = new Map<string, Executor>();
  for (const app of apps) {
    for (const ex of app.executors ?? []) {
      if (map.has(ex.kind)) throw new Error(`executor for kind ${ex.kind} registered twice`);
      map.set(ex.kind, ex);
    }
  }
  return map;
}
