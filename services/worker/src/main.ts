// OWNED BY: backend session. Entry point for @tools/worker.
import { sql } from "kysely";
import { RefundPayload } from "@tools/contracts";
import { buildSummary, createDb, withTx, writeAudit, type Db, type ExecutionJobRow } from "@tools/server-core";

const POLL_MS = 500;
const LEASE_MS = 10_000;
const RETRY_DELAY_MS = 1_000;
const MAX_ATTEMPTS = 5;
const HTTP_TIMEOUT_MS = 3_000;
const ACTOR = "system:worker";

type ClaimedJob = ExecutionJobRow & { payload: unknown };

async function claimJob(db: Db): Promise<ClaimedJob | null> {
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
    const req = await tx.selectFrom("approval_requests").select("payload").where("id", "=", job.request_id).executeTakeFirstOrThrow();
    return { ...leased, payload: req.payload };
  });
}

interface SimulatorResult {
  providerRef: string;
}

async function callSimulator(baseUrl: string, job: ClaimedJob): Promise<SimulatorResult> {
  const payload = RefundPayload.parse(job.payload);
  const res = await fetch(`${baseUrl}/refunds`, {
    method: "POST",
    headers: { "content-type": "application/json", "Idempotency-Key": job.idempotency_key },
    body: JSON.stringify({ paymentId: payload.paymentId, amountMinor: payload.amountMinor, currency: payload.currency }),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  if (res.status !== 200 && res.status !== 201) throw new Error(`simulator returned ${res.status}`);
  const body = (await res.json()) as { providerRef?: unknown };
  if (typeof body.providerRef !== "string") throw new Error("simulator response missing providerRef");
  return { providerRef: body.providerRef };
}

async function recordSuccess(db: Db, job: ClaimedJob, result: SimulatorResult): Promise<void> {
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
      summary: buildSummary({ kind: "refund", state: "SUCCEEDED" }),
    });
  });
}

async function recordFailure(db: Db, job: ClaimedJob, err: unknown): Promise<void> {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const exhausted = job.attempts >= MAX_ATTEMPTS;
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
        summary: buildSummary({ kind: "refund", state: "NEEDS_REVIEW", reason: `attempts=${job.attempts}` }),
      });
    }
  });
}

export async function processOne(db: Db, simulatorUrl: string): Promise<boolean> {
  const job = await claimJob(db);
  if (!job) return false;
  try {
    const result = await callSimulator(simulatorUrl, job);
    await recordSuccess(db, job, result);
    console.info(`job ${job.id} request ${job.request_id} SUCCEEDED (attempt ${job.attempts})`);
  } catch (err) {
    await recordFailure(db, job, err);
    console.warn(`job ${job.id} request ${job.request_id} attempt ${job.attempts} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  return true;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const simulatorUrl = process.env.PAYMENT_SIMULATOR_URL ?? "http://localhost:4100";
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const db = createDb(databaseUrl, 4);
  console.info(`worker polling every ${POLL_MS}ms, simulator ${simulatorUrl}`);
  let running = true;
  const stop = () => {
    running = false;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  while (running) {
    let didWork = false;
    try {
      didWork = await processOne(db, simulatorUrl);
    } catch (err) {
      console.error("worker loop error", err instanceof Error ? err.message : err);
    }
    if (!didWork) await new Promise((r) => setTimeout(r, POLL_MS));
  }
  await db.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
