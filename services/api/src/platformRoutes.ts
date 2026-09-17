import { sql } from "kysely";
import {
  AppError,
  assertSameOrigin,
  listRequestsWithJobs,
  loadRequestWithJob,
  requirePermission,
  resolveActor,
  toAuditEventDto,
  type AdminDb,
  type AppModule,
  type Db,
  type HttpApp,
} from "@tools/server-core";

/** Cross-app read endpoints: the shared approvals queue and the audit timeline. */
export function registerPlatformRoutes(app: HttpApp, db: Db): void {
  app.get("/api/approvals", async (request) => {
    const actor = resolveActor(request);
    requirePermission(actor, "approvals.read");
    return { requests: await listRequestsWithJobs(db) };
  });

  app.get<{ Params: { id: string } }>("/api/approvals/:id", async (request) => {
    const actor = resolveActor(request);
    requirePermission(actor, "approvals.read");
    const dto = await loadRequestWithJob(db, request.params.id);
    if (!dto) throw new AppError("NOT_FOUND", "request not found");
    return dto;
  });

  app.get<{ Querystring: { requestId?: string } }>("/api/audit", async (request) => {
    const actor = resolveActor(request);
    requirePermission(actor, "audit.read");
    const requestId = request.query.requestId;
    if (!requestId) throw new AppError("VALIDATION", "requestId is required");
    const rows = await db.selectFrom("audit_events").selectAll().where("request_id", "=", requestId).orderBy("id", "asc").execute();
    return { events: rows.map(toAuditEventDto) };
  });
}

/** Demo-only: truncate platform tables, then let each app return its own tables to seed state. */
export function registerDemoReset(app: HttpApp, adminDb: AdminDb, apps: readonly AppModule[], webOrigin: string | undefined): void {
  app.post("/api/demo/reset", async (request) => {
    assertSameOrigin(request, webOrigin);
    await sql`TRUNCATE execution_jobs, approval_requests, audit_events RESTART IDENTITY`.execute(adminDb);
    for (const mod of apps) await mod.demoReset?.(adminDb);
    return { ok: true };
  });
}
