import { sql } from "kysely";
import { buildSummary, withTx, writeAudit, type Db, type Executor, type ExecutionJobRow, type ExecutionResult } from "@tools/server-core";

export const LEASE_MS = 10_000;
export const RETRY_DELAY_MS = 1_000;
export const MAX_ATTEMPTS = 5;
const ACTOR = "system:worker";

export type ClaimedJob = ExecutionJobRow & { kind: string; payload: unknown };

export async function claimJob(db: Db): Promise<ClaimedJob | null> {
  return withTx(db, async (tx) => {
    const job = await tx
      .selectFrom("execution_jobs")
      .selectAll()
      .where("state", "in", ["QUEUED", "RETRY_WAIT"])
      .where((eb) => eb.or([eb("lease_until", "is", null), eb("lease_until", "<", sql<Date>`now()`)]))
      .orderBy("id", "asc")
      .limit(1)
      .forUpdate()
      .skipLocked()
      .executeTakeFirst();
    if (!job) return null;
    const leased = await tx
      .updateTable("execution_jobs")
      .set({ state: "LEASED", attempts: job.attempts + 1, lease_until: new Date(Date.now() + LEASE_MS), updated_at: new Date() })
      .where("id", "=", job.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    const req = await tx.selectFrom("approval_requests").select(["kind", "payload"]).where("id", "=", job.request_id).executeTakeFirstOrThrow();
    return { ...leased, kind: req.kind, payload: req.payload };
  });
}

async function recordSuccess(db: Db, job: ClaimedJob, result: ExecutionResult): Promise<void> {
  await withTx(db, async (tx) => {
    await tx
      .updateTable("execution_jobs")
      .set({ state: "SUCCEEDED", provider_ref: result.providerRef, lease_until: null, last_error: null, updated_at: new Date() })
      .where("id", "=", job.id)
      .execute();
    await writeAudit(tx, {
      actorId: ACTOR,
      action: "execution.succeeded",
      objectId: job.request_id,
      requestId: job.request_id,
      outcome: "ok",
      summary: buildSummary({ kind: job.kind, state: "SUCCEEDED" }),
    });
  });
}

async function recordFailure(db: Db, job: ClaimedJob, err: unknown, opts: { terminal?: boolean } = {}): Promise<void> {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const exhausted = opts.terminal === true || job.attempts >= MAX_ATTEMPTS;
  await withTx(db, async (tx) => {
    await tx
      .updateTable("execution_jobs")
      .set({
        state: exhausted ? "NEEDS_REVIEW" : "RETRY_WAIT",
        lease_until: exhausted ? null : new Date(Date.now() + RETRY_DELAY_MS),
        last_error: message.slice(0, 500),
        updated_at: new Date(),
      })
      .where("id", "=", job.id)
      .execute();
    if (exhausted) {
      await writeAudit(tx, {
        actorId: ACTOR,
        action: "execution.failed",
        objectId: job.request_id,
        requestId: job.request_id,
        outcome: "failed",
        summary: buildSummary({ kind: job.kind, state: "NEEDS_REVIEW", reason: `attempts=${job.attempts}` }),
      });
    }
  });
}

/** Claims one job, runs the executor registered for its request kind, records the outcome. Returns false when idle. */
export async function processOne(db: Db, executors: Map<string, Executor>, env: NodeJS.ProcessEnv): Promise<boolean> {
  const job = await claimJob(db);
  if (!job) return false;
  const executor = executors.get(job.kind);
  if (!executor) {
    await recordFailure(db, job, new Error(`no executor for kind ${job.kind}`), { terminal: true });
    console.error(`job ${job.id} request ${job.request_id}: no executor for kind ${job.kind}`);
    return true;
  }
  try {
    const result = await executor.execute({ job, payload: job.payload }, env);
    await recordSuccess(db, job, result);
    console.info(`job ${job.id} request ${job.request_id} SUCCEEDED (attempt ${job.attempts})`);
  } catch (err) {
    await recordFailure(db, job, err);
    console.warn(`job ${job.id} request ${job.request_id} attempt ${job.attempts} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  return true;
}
