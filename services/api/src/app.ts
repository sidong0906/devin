import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import {
  createAdminDb,
  createDb,
  isDemoMode,
  registerActionRoutes,
  registerApprovalsDecideAction,
  registerDemoSession,
  registerErrorHandler,
  resolveActor,
  type AppModule,
  type Db,
} from "@tools/server-core";
import { APPS } from "@tools/app-manifest";
import { registerDemoReset, registerPlatformRoutes } from "./platformRoutes.js";

export interface ApiEnv {
  DATABASE_URL: string;
  MIGRATION_DATABASE_URL?: string | undefined;
  SESSION_SECRET: string;
  DEMO_AUTH?: string | undefined;
  NODE_ENV?: string | undefined;
  WEB_ORIGIN?: string | undefined;
}

// Action and policy registries are process-wide; register each module once even if buildApp runs twice (tests).
const registeredModules = new WeakSet<AppModule>();
let platformRegistered = false;

function registerDomain(apps: readonly AppModule[]): void {
  if (!platformRegistered) {
    platformRegistered = true;
    registerApprovalsDecideAction();
  }
  for (const mod of apps) {
    if (registeredModules.has(mod)) continue;
    registeredModules.add(mod);
    mod.register();
  }
}

export function buildApp(env: ApiEnv, apps: readonly AppModule[] = APPS): { app: FastifyInstance; db: Db } {
  registerDomain(apps);
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

  registerActionRoutes(app, { db, demoMode, webOrigin: env.WEB_ORIGIN });
  registerPlatformRoutes(app, db);
  for (const mod of apps) mod.registerRoutes(app, db);

  if (demoMode && env.MIGRATION_DATABASE_URL) {
    const adminDb = createAdminDb(env.MIGRATION_DATABASE_URL);
    registerDemoReset(app, adminDb, apps, env.WEB_ORIGIN);
    app.addHook("onClose", async () => {
      await adminDb.destroy();
    });
  }

  app.addHook("onClose", async () => {
    await db.destroy();
  });

  return { app, db };
}
