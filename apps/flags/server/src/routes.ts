import { FlagsResponse, type FlagDto } from "@tools/contracts";
import type { z } from "zod";
import { sql } from "kysely";
import { resolveActor, type Db, type HttpApp } from "@tools/server-core";
import { flagsDb } from "./db.js";

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
