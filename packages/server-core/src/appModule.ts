import type { Kysely } from "kysely";
import type { RequestKind } from "@tools/contracts";
import type { Db, ExecutionJobRow } from "./db.js";
import type { HttpApp } from "./errors.js";

/** Handle with elevated (migrator) grants. Used only for seeding and demo reset. */
export type AdminDb = Kysely<Record<string, never>>;

export interface ExecutionJobInput {
  job: ExecutionJobRow;
  payload: unknown;
}

export interface ExecutionResult {
  providerRef: string;
}

/**
 * Performs the external side effect for an approved request of one kind.
 * Must be idempotent on `job.idempotency_key`; the worker retries with the same key.
 */
export interface Executor {
  kind: RequestKind;
  execute(input: ExecutionJobInput, env: NodeJS.ProcessEnv): Promise<ExecutionResult>;
}

/**
 * Everything the platform needs to host one internal tool. An app is a folder under `apps/<name>/server`
 * that exports one of these; the manifest in `packages/app-manifest` is the only wiring a new app touches.
 */
export interface AppModule {
  name: string;
  /** Register actions, review policies, and request summaries. Runs once per process. */
  register(): void;
  /** Read-only routes owned by the app. Mutations go through `/api/actions/:name`. */
  registerRoutes(app: HttpApp, db: Db): void;
  /** Idempotent seed of app-owned tables. */
  seed?(db: AdminDb): Promise<void>;
  /** Return app-owned tables to seed state. Platform tables are reset by the API. */
  demoReset?(db: AdminDb): Promise<void>;
  /** Side-effect executors run by `services/worker`. */
  executors?: Executor[];
}

export function defineApp(module: AppModule): AppModule {
  return module;
}
