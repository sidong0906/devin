// Feature-flag change control: propose (optimistic version) -> independent approve -> synchronous publish.
import { randomUUID } from "node:crypto";
import { FlagChangePayload, FlagProposeBody, FlagsResponse, type ActionAccepted, type FlagDto } from "@tools/contracts";
import type { z } from "zod";
import { sql, type Kysely, type Selectable, type Transaction } from "kysely";
import {
  AppError,
  loadRequestWithJob,
  registerAction,
  registerReviewPolicy,
  resolveActor,
  withTx,
  writeAudit,
  type ApprovalRequestRow,
  type Database,
  type Db,
  type HttpApp,
  type Tx,
} from "@tools/server-core";

export interface FeatureFlagsTable {
  key: string;
  value: boolean;
  version: number;
  updated_at: Date;
  updated_by_id: string | null;
}
export type FeatureFlagRow = Selectable<FeatureFlagsTable>;

type FlagsDatabase = Database & { feature_flags: FeatureFlagsTable };
type FlagsDb = Kysely<FlagsDatabase>;
type FlagsTx = Transaction<FlagsDatabase>;

// server-core's Database type does not know about app-owned tables; widen the handle locally.
function flagsDb(db: Db): FlagsDb {
  return db.withTables<{ feature_flags: FeatureFlagsTable }>();
}
function flagsTx(tx: Tx): FlagsTx {
  return tx.withTables<{ feature_flags: FeatureFlagsTable }>();
}

export function flagSubjectKey(key: string, expectedVersion: number): string {
  return `flag:${key}:v${expectedVersion}`;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

async function lockFlag(tx: FlagsTx, key: string): Promise<FeatureFlagRow | undefined> {
  return tx.selectFrom("feature_flags").selectAll().where("key", "=", key).forUpdate().executeTakeFirst();
}

/** Applies an approved flag_change inside the shared decide transaction. Throws STALE_VERSION to roll it back. */
export async function publishApprovedFlagChange(tx: Tx, request: ApprovalRequestRow): Promise<void> {
  const payload = FlagChangePayload.parse(request.payload);
  const ftx = flagsTx(tx);
  const flag = await lockFlag(ftx, payload.flagKey);
  if (!flag) throw new AppError("NOT_FOUND", "flag not found");
  if (flag.version !== payload.expectedVersion) {
    throw new AppError("STALE_VERSION", `flag ${payload.flagKey} is at version ${flag.version}, proposal expected ${payload.expectedVersion}`);
  }
  const decider = request.decided_by_id ?? "system";
  const newVersion = flag.version + 1;
  await ftx
    .updateTable("feature_flags")
    .set({ value: payload.newValue, version: newVersion, updated_by_id: decider, updated_at: new Date() })
    .where("key", "=", payload.flagKey)
    .execute();
  await writeAudit(tx, {
    actorId: decider,
    action: "flags.published",
    objectId: payload.flagKey,
    requestId: request.id,
    outcome: "ok",
    summary: `kind=flag_change flag=${payload.flagKey} value=${payload.newValue} v=${newVersion}`,
  });
}

export function registerFlags(): void {
  registerAction({
    name: "flags.propose",
    permission: "flags.propose",
    body: FlagProposeBody,
    handler: async (ctx, body: z.infer<typeof FlagProposeBody>): Promise<z.infer<typeof ActionAccepted>> => {
      const requestId = `req_${randomUUID()}`;
      return withTx(ctx.db, async (tx) => {
        const flag = await lockFlag(flagsTx(tx), body.flagKey);
        if (!flag) throw new AppError("NOT_FOUND", "flag not found");
        if (flag.version !== body.expectedVersion) {
          throw new AppError("STALE_VERSION", `flag ${body.flagKey} is at version ${flag.version}, expected ${body.expectedVersion}`);
        }
        const payload: z.infer<typeof FlagChangePayload> = {
          kind: "flag_change",
          flagKey: flag.key,
          expectedVersion: body.expectedVersion,
          newValue: body.newValue,
        };
        try {
          await tx
            .insertInto("approval_requests")
            .values({
              id: requestId,
              kind: "flag_change",
              requester_id: ctx.actor.id,
              payload: JSON.stringify(payload),
              subject_key: flagSubjectKey(flag.key, body.expectedVersion),
            })
            .execute();
        } catch (err) {
          if (isUniqueViolation(err)) throw new AppError("DUPLICATE_REQUEST", "a change is already proposed for this flag version");
          throw err;
        }
        await writeAudit(tx, {
          actorId: ctx.actor.id,
          action: "flags.propose",
          objectId: flag.key,
          requestId,
          outcome: "ok",
          summary: `kind=flag_change flag=${flag.key} from=${flag.value} to=${body.newValue} v=${body.expectedVersion}`,
        });
        const dto = await loadRequestWithJob(tx, requestId);
        if (!dto) throw new AppError("NOT_FOUND", "request not found");
        return { requestId, request: dto };
      });
    },
  });

  registerReviewPolicy({
    kind: "flag_change",
    permission: "flags.review",
    onApproved: publishApprovedFlagChange,
  });
}

export async function listFlags(db: Db): Promise<FlagDto[]> {
  const rows = await flagsDb(db)
    .selectFrom("feature_flags as f")
    .leftJoin("approval_requests as r", (join) =>
      join
        .on("r.subject_key", "=", sql<string>`'flag:' || f.key || ':v' || f.version`)
        .on("r.kind", "=", "flag_change")
        .on("r.decision", "=", "PENDING"),
    )
    .select(["f.key", "f.value", "f.version", "f.updated_at", "f.updated_by_id", "r.id as pending_request_id"])
    .orderBy("f.key", "asc")
    .execute();
  return rows.map((r) => ({
    key: r.key,
    value: r.value,
    version: r.version,
    updatedAt: r.updated_at.toISOString(),
    updatedById: r.updated_by_id,
    pendingRequestId: r.pending_request_id,
  }));
}

export function registerFlagRoutes(app: HttpApp, db: Db): void {
  app.get("/api/flags", async (request): Promise<z.infer<typeof FlagsResponse>> => {
    resolveActor(request);
    return FlagsResponse.parse({ flags: await listFlags(db) });
  });
}
