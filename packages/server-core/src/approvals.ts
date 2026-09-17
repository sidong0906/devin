import { DecideBody, type ActionAccepted, type Actor, type ApprovalRequestDto, type Permission, type RequestKind } from "@tools/contracts";
import type { z } from "zod";
import { withTx, type ApprovalRequestRow, type Db, type Tx } from "./db.js";
import { AppError } from "./errors.js";
import { buildSummary, writeAudit } from "./audit.js";
import { hasPermission } from "./identity.js";
import { registerAction } from "./actions.js";
import { toApprovalRequestDto } from "./dto.js";

type ActionAcceptedDto = z.infer<typeof ActionAccepted>;

export interface ReviewPolicy {
  kind: RequestKind;
  permission: Permission;
  onApproved: (tx: Tx, request: ApprovalRequestRow) => Promise<void>;
}

const policies = new Map<string, ReviewPolicy>();

export function registerReviewPolicy(policy: ReviewPolicy): void {
  if (policies.has(policy.kind)) throw new Error(`review policy for ${policy.kind} already registered`);
  policies.set(policy.kind, policy);
}

export function getReviewPolicy(kind: string): ReviewPolicy | undefined {
  return policies.get(kind);
}

export const DEMO_FAULT_HEADER = "x-demo-fault";

export class DemoFaultError extends Error {
  constructor() {
    super("demo fault: throw_before_commit");
    this.name = "DemoFaultError";
  }
}

export interface DecideOptions {
  throwBeforeCommit?: boolean;
}

export async function loadRequestWithJob(db: Db | Tx, requestId: string): Promise<ApprovalRequestDto | null> {
  const row = await db.selectFrom("approval_requests").selectAll().where("id", "=", requestId).executeTakeFirst();
  if (!row) return null;
  const job = await db
    .selectFrom("execution_jobs")
    .select(["state", "provider_ref", "attempts", "last_error"])
    .where("request_id", "=", requestId)
    .executeTakeFirst();
  return toApprovalRequestDto(row, job);
}

export async function listRequestsWithJobs(db: Db): Promise<ApprovalRequestDto[]> {
  const rows = await db
    .selectFrom("approval_requests as r")
    .leftJoin("execution_jobs as j", "j.request_id", "r.id")
    .select([
      "r.id",
      "r.kind",
      "r.requester_id",
      "r.payload",
      "r.subject_key",
      "r.decision",
      "r.decided_by_id",
      "r.decided_at",
      "r.created_at",
      "j.state as job_state",
      "j.provider_ref as job_provider_ref",
      "j.attempts as job_attempts",
      "j.last_error as job_last_error",
    ])
    .orderBy("r.created_at", "desc")
    .execute();
  return rows.map((r) =>
    toApprovalRequestDto(
      {
        id: r.id,
        kind: r.kind,
        requester_id: r.requester_id,
        payload: r.payload,
        subject_key: r.subject_key,
        decision: r.decision,
        decided_by_id: r.decided_by_id,
        decided_at: r.decided_at,
        created_at: r.created_at,
      },
      r.job_state === null
        ? null
        : { state: r.job_state, provider_ref: r.job_provider_ref, attempts: r.job_attempts ?? 0, last_error: r.job_last_error },
    ),
  );
}

export async function decideRequest(
  db: Db,
  actor: Actor,
  requestId: string,
  decision: "approve" | "reject",
  opts: DecideOptions = {},
): Promise<ActionAcceptedDto> {
  return withTx(db, async (tx) => {
    const row = await tx.selectFrom("approval_requests").selectAll().where("id", "=", requestId).forUpdate().executeTakeFirst();
    if (!row) throw new AppError("NOT_FOUND", "request not found");
    if (row.decision !== "PENDING") throw new AppError("ALREADY_DECIDED", `request already ${row.decision}`);
    if (row.requester_id === actor.id) throw new AppError("SELF_APPROVAL", "requester cannot decide own request");
    const policy = policies.get(row.kind);
    if (!policy) throw new AppError("FORBIDDEN", `no review policy for kind ${row.kind}`);
    if (!hasPermission(actor, policy.permission)) throw new AppError("FORBIDDEN", `missing permission ${policy.permission}`);

    const newDecision = decision === "approve" ? "APPROVED" : "REJECTED";
    const now = new Date();
    await tx
      .updateTable("approval_requests")
      .set({ decision: newDecision, decided_by_id: actor.id, decided_at: now })
      .where("id", "=", requestId)
      .execute();
    await writeAudit(tx, {
      actorId: actor.id,
      action: "approvals.decide",
      objectId: requestId,
      requestId,
      outcome: "ok",
      summary: buildSummary({ kind: row.kind, decision: newDecision }),
    });
    const updated: ApprovalRequestRow = { ...row, decision: newDecision, decided_by_id: actor.id, decided_at: now };
    if (newDecision === "APPROVED") await policy.onApproved(tx, updated);
    if (opts.throwBeforeCommit) throw new DemoFaultError();

    const dto = await loadRequestWithJob(tx, requestId);
    if (!dto) throw new AppError("NOT_FOUND", "request not found");
    return { requestId, request: dto };
  });
}

export function registerApprovalsDecideAction(): void {
  registerAction({
    name: "approvals.decide",
    permission: "approvals.read",
    body: DecideBody,
    handler: async (ctx, body: z.infer<typeof DecideBody>) => {
      const fault = ctx.request.headers[DEMO_FAULT_HEADER];
      const throwBeforeCommit = ctx.demoMode && fault === "throw_before_commit";
      return decideRequest(ctx.db, ctx.actor, body.requestId, body.decision, { throwBeforeCommit });
    },
  });
}
