import { sql } from "kysely";
import { SEED_PAYMENTS } from "@tools/contracts";
import type { AdminDb } from "@tools/server-core";

export async function seedRefunds(db: AdminDb): Promise<void> {
  for (const p of SEED_PAYMENTS) {
    await sql`
      INSERT INTO payments (id, amount_minor, currency, customer_email, captured_at)
      VALUES (${p.id}, ${p.amountMinor}, ${p.currency}, ${p.customerEmail}, ${p.capturedAt})
      ON CONFLICT (id) DO UPDATE SET amount_minor = EXCLUDED.amount_minor, currency = EXCLUDED.currency,
        customer_email = EXCLUDED.customer_email, captured_at = EXCLUDED.captured_at
    `.execute(db);
  }
}
