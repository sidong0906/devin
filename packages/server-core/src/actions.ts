import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodObject, ZodRawShape, z } from "zod";
import { ActionName, type Actor, type Permission } from "@tools/contracts";
import type { Db } from "./db.js";
import { AppError } from "./errors.js";
import { assertSameOrigin, hasPermission, resolveActor } from "./identity.js";
import { writeAudit } from "./audit.js";

export interface ActionContext {
  actor: Actor;
  db: Db;
  request: FastifyRequest;
  demoMode: boolean;
}

export interface ActionDefinition<S extends ZodObject<ZodRawShape> = ZodObject<ZodRawShape>> {
  name: ActionName;
  permission: Permission;
  body: S;
  handler: (ctx: ActionContext, body: z.infer<S>) => Promise<unknown>;
}

const registry = new Map<string, ActionDefinition>();

export function registerAction<S extends ZodObject<ZodRawShape>>(def: ActionDefinition<S>): void {
  if (!def.permission) throw new Error(`action ${def.name} must declare a permission`);
  if (registry.has(def.name)) throw new Error(`action ${def.name} already registered`);
  registry.set(def.name, def as unknown as ActionDefinition);
}

export function getAction(name: string): ActionDefinition | undefined {
  return registry.get(name);
}

export function listActions(): ActionDefinition[] {
  return [...registry.values()];
}

export function clearActionsForTest(): void {
  registry.clear();
}

/** Deny-by-default: unknown names, missing permission, and unknown body fields are all rejected. */
export function authorizeAction(actor: Actor, name: string): ActionDefinition {
  const def = registry.get(name);
  if (!def || !ActionName.safeParse(name).success) throw new AppError("NOT_FOUND", `unknown action ${name}`);
  if (!hasPermission(actor, def.permission)) throw new AppError("FORBIDDEN", `missing permission ${def.permission}`);
  return def;
}

function objectIdFromBody(body: unknown): string {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    for (const key of ["requestId", "paymentId", "flagKey"]) {
      const v = b[key];
      if (typeof v === "string") return v;
    }
  }
  return "-";
}

export interface ActionRouteOptions {
  db: Db;
  demoMode: boolean;
  webOrigin: string | undefined;
}

export function registerActionRoutes(app: FastifyInstance, opts: ActionRouteOptions): void {
  app.post<{ Params: { name: string } }>("/api/actions/:name", async (request) => {
    assertSameOrigin(request, opts.webOrigin);
    const actor = resolveActor(request);
    const name = request.params.name;
    let def: ActionDefinition;
    try {
      def = authorizeAction(actor, name);
    } catch (err) {
      if (err instanceof AppError && err.code === "FORBIDDEN") {
        const objectId = objectIdFromBody(request.body);
        await writeAudit(opts.db, {
          actorId: actor.id,
          action: name,
          objectId,
          requestId: objectId,
          outcome: "denied",
          summary: `action=${name} reason=missing_permission`,
        });
      }
      throw err;
    }
    const body = def.body.strict().parse(request.body ?? {});
    return def.handler({ actor, db: opts.db, request, demoMode: opts.demoMode }, body);
  });
}
