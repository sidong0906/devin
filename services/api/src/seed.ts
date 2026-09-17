import pg from "pg";
import { SEED_FLAGS, SEED_PAYMENTS } from "@tools/contracts";

export async function seed(connectionString: string): Promise<void> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    for (const p of SEED_PAYMENTS) {
      await client.query(
        `INSERT INTO payments (id, amount_minor, currency, customer_email, captured_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET amount_minor = EXCLUDED.amount_minor, currency = EXCLUDED.currency,
           customer_email = EXCLUDED.customer_email, captured_at = EXCLUDED.captured_at`,
        [p.id, p.amountMinor, p.currency, p.customerEmail, p.capturedAt],
      );
    }
    for (const f of SEED_FLAGS) {
      await client.query(
        `INSERT INTO feature_flags (key, value, version, updated_at, updated_by_id)
         VALUES ($1, $2, 0, now(), NULL)
         ON CONFLICT (key) DO NOTHING`,
        [f.key, f.value],
      );
    }
  } finally {
    await client.end();
  }
}

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) {
  console.error("MIGRATION_DATABASE_URL is required");
  process.exit(1);
}
seed(url)
  .then(() => console.info(`seeded ${SEED_PAYMENTS.length} payments, ${SEED_FLAGS.length} flags`))
  .catch((err) => {
    console.error("seed failed", err instanceof Error ? err.message : err);
    process.exit(1);
  });
