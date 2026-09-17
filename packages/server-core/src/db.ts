import { Kysely, PostgresDialect, type Generated, type Selectable, type Transaction } from "kysely";
import pg from "pg";

export interface ApprovalRequestsTable {
  id: string;
  kind: string;
  requester_id: string;
  payload: unknown;
  subject_key: string;
  decision: Generated<string>;
  decided_by_id: Generated<string | null>;
  decided_at: Generated<Date | null>;
  created_at: Generated<Date>;
}
export type ApprovalRequestRow = Selectable<ApprovalRequestsTable>;

export interface AuditEventsTable {
  id: Generated<number>;
  at: Generated<Date>;
  actor_id: string;
  action: string;
  object_id: string;
  request_id: string;
  outcome: "ok" | "denied" | "failed";
  summary: string;
}
export type AuditEventRow = Selectable<AuditEventsTable>;

export interface ExecutionJobsTable {
  id: Generated<number>;
  request_id: string;
  idempotency_key: string;
  state: string;
  attempts: Generated<number>;
  lease_until: Generated<Date | null>;
  provider_ref: Generated<string | null>;
  last_error: Generated<string | null>;
  updated_at: Generated<Date>;
}
export type ExecutionJobRow = Selectable<ExecutionJobsTable>;

/** Platform-owned tables. Apps widen the handle for their own tables with `db.withTables<...>()`. */
export interface Database {
  approval_requests: ApprovalRequestsTable;
  audit_events: AuditEventsTable;
  execution_jobs: ExecutionJobsTable;
}

export type Db = Kysely<Database>;
export type Tx = Transaction<Database>;

export function createDb(connectionString: string, max = 10): Db {
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString, max }) }) });
}

/** Elevated (migrator-role) handle for seed and demo reset. Raw `sql` only; app tables are not typed here. */
export function createAdminDb(connectionString: string, max = 2): Kysely<Record<string, never>> {
  return new Kysely<Record<string, never>>({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString, max }) }) });
}

export function withTx<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction().execute(fn);
}
