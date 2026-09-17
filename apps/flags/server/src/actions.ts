import { randomUUID } from "node:crypto";
import { FlagChangePayload, FlagProposeBody, type ActionAccepted } from "@tools/contracts";
import type { z } from "zod";
import {
  AppError,
  buildSummary,
  isUniqueViolation,
  loadRequestWithJob,
  registerAction,
  registerRequestSummary,
  registerReviewPolicy,
  withTx,
  writeAudit,
  type ApprovalRequestRow,
  type Tx,
} from "@tools/server-core";
import { flagSubjectKey, flagsTx, lockFlag } from "./db.js";

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
  registerRequestSummary("flag_change", (p) => buildSummary({ kind: "flag_change", reason: `${p.flagKey}->${p.newValue}` }));

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
