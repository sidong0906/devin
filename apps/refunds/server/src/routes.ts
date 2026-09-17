import type { PaymentsResponse } from "@tools/contracts";
import type { z } from "zod";
import { sql } from "kysely";
import { requirePermission, resolveActor, type Db, type HttpApp } from "@tools/server-core";
import { refundsDb, toPaymentDto } from "./db.js";

export function registerRefundRoutes(app: HttpApp, db: Db): void {
  app.get("/api/refunds/payments", async (request): Promise<z.infer<typeof PaymentsResponse>> => {
    const actor = resolveActor(request);
    requirePermission(actor, "refunds.request", "approvals.read");
    const rows = await refundsDb(db)
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
