import type { Kysely, Selectable, Transaction } from "kysely";
import type { Database, Db, Tx } from "@tools/server-core";

export interface FeatureFlagsTable {
  key: string;
  value: boolean;
  version: number;
  updated_at: Date;
  updated_by_id: string | null;
}
export type FeatureFlagRow = Selectable<FeatureFlagsTable>;

type FlagsDatabase = Database & { feature_flags: FeatureFlagsTable };
export type FlagsDb = Kysely<FlagsDatabase>;
export type FlagsTx = Transaction<FlagsDatabase>;

export function flagsDb(db: Db): FlagsDb {
  return db.withTables<{ feature_flags: FeatureFlagsTable }>();
}

export function flagsTx(tx: Tx): FlagsTx {
  return tx.withTables<{ feature_flags: FeatureFlagsTable }>();
}

export function flagSubjectKey(key: string, expectedVersion: number): string {
  return `flag:${key}:v${expectedVersion}`;
}

export async function lockFlag(tx: FlagsTx, key: string): Promise<FeatureFlagRow | undefined> {
  return tx.selectFrom("feature_flags").selectAll().where("key", "=", key).forUpdate().executeTakeFirst();
}
