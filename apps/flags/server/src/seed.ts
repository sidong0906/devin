import { sql } from "kysely";
import { SEED_FLAGS } from "@tools/contracts";
import type { AdminDb } from "@tools/server-core";

export async function seedFlags(db: AdminDb): Promise<void> {
  for (const f of SEED_FLAGS) {
    await sql`
      INSERT INTO feature_flags (key, value, version, updated_at, updated_by_id)
      VALUES (${f.key}, ${f.value}, 0, now(), NULL)
      ON CONFLICT (key) DO NOTHING
    `.execute(db);
  }
}

export async function resetFlags(db: AdminDb): Promise<void> {
  for (const f of SEED_FLAGS) {
    await sql`
      UPDATE feature_flags
      SET value = ${f.value}, version = 0, updated_at = now(), updated_by_id = NULL
      WHERE key = ${f.key}
    `.execute(db);
  }
}
