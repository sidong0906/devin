import { randomUUID } from "node:crypto";
import { RefundRequestBody, maskEmail, type ActionAccepted } from "@tools/contracts";
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
} from "@tools/server-core";
import { refundIdempotencyKey, refundSubjectKey, refundsDb } from "./db.js";

export function registerRefunds(): void {
  registerRequestSummary("refund", (p) =>
    buildSummary({ kind: "refund", customerRef: p.customerRef, amountMinor: p.amountMinor, currency: p.currency }),
  );

  registerAction({
    name: "refunds.request",
    permission: "refunds.request",
    body: RefundRequestBody,
    handler: async (ctx, body: z.infer<typeof RefundRequestBody>): Promise<z.infer<typeof ActionAccepted>> => {
      const payment = await refundsDb(ctx.db).selectFrom("payments").selectAll().where("id", "=", body.paymentId).executeTakeFirst();
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
