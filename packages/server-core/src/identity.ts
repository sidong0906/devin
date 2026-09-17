import type { FastifyInstance, FastifyRequest } from "fastify";
import "@fastify/cookie";
import { DEMO_USERS, DemoSessionBody, DemoUserKey, SESSION_COOKIE, type Actor } from "@tools/contracts";
import { AppError } from "./errors.js";

export interface DemoAuthEnv {
  DEMO_AUTH?: string | undefined;
  NODE_ENV?: string | undefined;
}

export function isDemoMode(env: DemoAuthEnv): boolean {
  return env.DEMO_AUTH === "true" && env.NODE_ENV !== "production";
}

/** Production startup must fail while only demo identity is configured. */
export function assertDemoAuthAllowed(env: DemoAuthEnv): void {
  if (env.DEMO_AUTH === "true" && env.NODE_ENV === "production") {
    throw new Error("DEMO_AUTH=true is not allowed when NODE_ENV=production");
  }
}

function isDemoUserKey(value: string): value is DemoUserKey {
  return DemoUserKey.safeParse(value).success;
}

export function resolveActor(request: FastifyRequest): Actor {
  const raw = request.cookies[SESSION_COOKIE];
  if (!raw) throw new AppError("UNAUTHENTICATED", "no session");
  const unsigned = request.unsignCookie(raw);
  if (!unsigned.valid || !unsigned.value || !isDemoUserKey(unsigned.value)) {
    throw new AppError("UNAUTHENTICATED", "invalid session");
  }
  const user = DEMO_USERS[unsigned.value];
  return { id: user.id, displayName: user.displayName, permissions: [...user.permissions] };
}

export function hasPermission(actor: Actor, permission: Actor["permissions"][number]): boolean {
  return actor.permissions.includes(permission);
}

export function requirePermission(actor: Actor, ...anyOf: Actor["permissions"]): void {
  if (!anyOf.some((p) => hasPermission(actor, p))) throw new AppError("FORBIDDEN", `missing permission ${anyOf.join("|")}`);
}

export function registerDemoSession(app: FastifyInstance, env: DemoAuthEnv, webOrigin: string | undefined): void {
  if (!isDemoMode(env)) return;
  app.post("/api/demo/session", async (request, reply) => {
    assertSameOrigin(request, webOrigin);
    const body = DemoSessionBody.parse(request.body ?? {});
    reply.setCookie(SESSION_COOKIE, body.user, { httpOnly: true, sameSite: "strict", path: "/", signed: true });
    const user = DEMO_USERS[body.user];
    return { id: user.id, displayName: user.displayName, permissions: [...user.permissions] };
  });
}

/** Same-origin guard for mutating routes. Missing Origin (non-browser clients) is allowed. */
export function assertSameOrigin(request: FastifyRequest, webOrigin: string | undefined): void {
  const origin = request.headers.origin;
  if (!origin) return;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError("FORBIDDEN", "invalid origin");
  }
  const allowed = new Set<string>();
  if (request.headers.host) allowed.add(request.headers.host);
  if (webOrigin) {
    try {
      allowed.add(new URL(webOrigin).host);
    } catch {
      /* ignore malformed WEB_ORIGIN */
    }
  }
  if (!allowed.has(originHost)) throw new AppError("FORBIDDEN", "cross-origin request rejected");
}
