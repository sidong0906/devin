// OWNED BY: backend session. Refund-specific action handlers (request, review policy, execution job creation).
import { randomUUID } from "node:crypto";
import { RefundRequestBody, maskEmail, type ActionAccepted, type PaymentsResponse } from "@tools/contracts";
import type { z } from "zod";
import { sql } from "kysely";
import {
  AppError,
  buildSummary,
  loadRequestWithJob,
  registerAction,
  registerReviewPolicy,
  requirePermission,
  resolveActor,
  toPaymentDto,
  withTx,
  writeAudit,
  type Db,
  type HttpApp,
} from "@tools/server-core";

export function refundSubjectKey(paymentId: string): string {
  return `refund:${paymentId}`;
}

export function refundIdempotencyKey(requestId: string): string {
  return `refund:${requestId}`;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

export function registerRefunds(): void {
  registerAction({
    name: "refunds.request",
    permission: "refunds.request",
    body: RefundRequestBody,
    handler: async (ctx, body: z.infer<typeof RefundRequestBody>): Promise<z.infer<typeof ActionAccepted>> => {
      const payment = await ctx.db.selectFrom("payments").selectAll().where("id", "=", body.paymentId).executeTakeFirst();
      if (!payment) throw new AppError("NOT_FOUND", "payment not found");
      const payload = {
        kind: "refund" as const,
        paymentId: payment.id,
        amountMinor: payment.amount_minor,
        currency: "USD" as const,
        customerRef: maskEmail(payment.customer_email),
      };
      const requestId = `req_${randomUUID()}`;
      return withTx(ctx.db, async (tx) => {
        try {
          await tx
            .insertInto("approval_requests")
            .values({
              id: requestId,
              kind: "refund",
              requester_id: ctx.actor.id,
              payload: JSON.stringify(payload),
              subject_key: refundSubjectKey(payment.id),
            })
            .execute();
        } catch (err) {
          if (isUniqueViolation(err)) throw new AppError("DUPLICATE_REQUEST", "a refund request already exists for this payment");
          throw err;
        }
        await writeAudit(tx, {
          actorId: ctx.actor.id,
          action: "refunds.request",
          objectId: payment.id,
          requestId,
          outcome: "ok",
          summary: buildSummary({ kind: "refund", customerRef: payload.customerRef, amountMinor: payload.amountMinor, currency: payload.currency }),
        });
        const dto = await loadRequestWithJob(tx, requestId);
        if (!dto) throw new AppError("NOT_FOUND", "request not found");
        return { requestId, request: dto };
      });
    },
  });

  registerReviewPolicy({
    kind: "refund",
    permission: "refunds.review",
    onApproved: async (tx, request) => {
      await tx
        .insertInto("execution_jobs")
        .values({ request_id: request.id, idempotency_key: refundIdempotencyKey(request.id), state: "QUEUED", attempts: 0, updated_at: new Date() })
        .execute();
    },
  });
}

export function registerRefundRoutes(app: HttpApp, db: Db): void {
  app.get("/api/refunds/payments", async (request): Promise<z.infer<typeof PaymentsResponse>> => {
    const actor = resolveActor(request);
    requirePermission(actor, "refunds.request", "approvals.read");
    const rows = await db
      .selectFrom("payments as p")
      .leftJoin("approval_requests as r", (join) => join.on("r.subject_key", "=", sql<string>`'refund:' || p.id`))
      .select(["p.id", "p.amount_minor", "p.currency", "p.customer_email", "p.captured_at", "r.id as refund_request_id"])
      .orderBy("p.captured_at", "asc")
      .execute();
    return {
      payments: rows.map((r) =>
        toPaymentDto(
          { id: r.id, amount_minor: r.amount_minor, currency: r.currency, customer_email: r.customer_email, captured_at: r.captured_at },
          r.refund_request_id,
        ),
      ),
    };
  });
}
