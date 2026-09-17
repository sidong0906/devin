import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import { sql } from "kysely";
import {
  assertSameOrigin,
  createDb,
  isDemoMode,
  listRequestsWithJobs,
  loadRequestWithJob,
  registerActionRoutes,
  registerApprovalsDecideAction,
  registerDemoSession,
  registerErrorHandler,
  requirePermission,
  resolveActor,
  toAuditEventDto,
  AppError,
  type Db,
} from "@tools/server-core";
import { registerRefundRoutes, registerRefunds } from "@tools/refunds-server";

export interface ApiEnv {
  DATABASE_URL: string;
  MIGRATION_DATABASE_URL?: string | undefined;
  SESSION_SECRET: string;
  DEMO_AUTH?: string | undefined;
  NODE_ENV?: string | undefined;
  WEB_ORIGIN?: string | undefined;
}

let registered = false;
function registerDomain(): void {
  if (registered) return;
  registered = true;
  registerApprovalsDecideAction();
  registerRefunds();
}

export function buildApp(env: ApiEnv): { app: FastifyInstance; db: Db } {
  registerDomain();
  const demoMode = isDemoMode(env);
  const db = createDb(env.DATABASE_URL);
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info", redact: ["req.headers.cookie", "req.headers.authorization", "res.headers.set-cookie"] },
    disableRequestLogging: false,
  });
  app.register(cookie, { secret: env.SESSION_SECRET });
  registerErrorHandler(app);

  app.get("/api/health", async () => ({ ok: true }));
  registerDemoSession(app, env, env.WEB_ORIGIN);

  app.get("/api/me", async (request) => resolveActor(request));

  registerRefundRoutes(app, db);
  registerActionRoutes(app, { db, demoMode, webOrigin: env.WEB_ORIGIN });

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

  if (demoMode && env.MIGRATION_DATABASE_URL) {
    const adminDb = createDb(env.MIGRATION_DATABASE_URL, 2);
    app.post("/api/demo/reset", async (request) => {
      assertSameOrigin(request, env.WEB_ORIGIN);
      await sql`TRUNCATE execution_jobs, approval_requests, audit_events RESTART IDENTITY`.execute(adminDb);
      return { ok: true };
    });
    app.addHook("onClose", async () => {
      await adminDb.destroy();
    });
  }

  app.addHook("onClose", async () => {
    await db.destroy();
  });

  return { app, db };
}
