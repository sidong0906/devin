/**
 * Black-box acceptance gates for the second app (feature flags), written BEFORE the app existed.
 * Owned by the coordinator. Runs against the same live stack as acceptance.test.ts.
 * The flags app must reuse the shared controls: deny-by-default actions, maker-checker decide,
 * append-only audit. Publishing happens inside the approval transaction (no worker/job).
 */
import { describe, it, expect, beforeAll } from "vitest";
import {
  ActionAccepted, ApiError, ApprovalResponse, AuditResponse, FlagsResponse, SEED_FLAGS, SESSION_COOKIE,
  type DemoUserKey,
} from "@tools/contracts";

const API = process.env.API_URL ?? "http://localhost:4000";
const SIM = process.env.SIMULATOR_URL ?? "http://localhost:4100";
const KEY = SEED_FLAGS[0].key;

type Session = { cookie: string };

async function login(user: DemoUserKey): Promise<Session> {
  const res = await fetch(`${API}/api/demo/session`, {
    method: "POST", headers: { "content-type": "application/json", origin: API }, body: JSON.stringify({ user }),
  });
  expect(res.status).toBe(200);
  const match = (res.headers.get("set-cookie") ?? "").match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return { cookie: `${SESSION_COOKIE}=${match![1]}` };
}

async function call(s: Session | null, method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { "content-type": "application/json", origin: API };
  if (s) headers.cookie = s.cookie;
  const res = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? null : JSON.stringify(body) });
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
}

function expectError(r: { status: number; json: unknown }, status: number, code: string) {
  expect(r.status).toBe(status);
  expect(ApiError.parse(r.json).code).toBe(code);
}

async function flag(s: Session, key: string) {
  const r = await call(s, "GET", "/api/flags");
  expect(r.status).toBe(200);
  const f = FlagsResponse.parse(r.json).flags.find((x) => x.key === key);
  expect(f, `flag ${key}`).toBeDefined();
  return f!;
}

let agent: Session, reviewer: Session, dual: Session, auditor: Session;

beforeAll(async () => {
  const r = await fetch(`${API}/api/demo/reset`, { method: "POST", headers: { origin: API } });
  expect(r.status).toBe(200);
  await fetch(`${SIM}/__test/reset`, { method: "POST" });
  [agent, reviewer, dual, auditor] = await Promise.all([login("agent"), login("reviewer"), login("dual"), login("auditor")]);
});

describe("F1 flags read + seed", () => {
  it("any authenticated actor can read published flags; anonymous cannot", async () => {
    expectError(await call(null, "GET", "/api/flags"), 401, "UNAUTHENTICATED");
    const f = await flag(agent, KEY);
    expect(f.value).toBe(SEED_FLAGS[0].value);
    expect(f.version).toBe(0);
    expect(f.pendingRequestId).toBeNull();
  });
});

describe("F2 propose: policy + optimistic version", () => {
  it("denies actors without flags.propose (agent, reviewer)", async () => {
    expectError(await call(agent, "POST", "/api/actions/flags.propose", { flagKey: KEY, expectedVersion: 0, newValue: true }), 403, "FORBIDDEN");
    expectError(await call(reviewer, "POST", "/api/actions/flags.propose", { flagKey: KEY, expectedVersion: 0, newValue: true }), 403, "FORBIDDEN");
  });
  it("rejects unknown flag, stale expectedVersion, and unknown body fields", async () => {
    expectError(await call(dual, "POST", "/api/actions/flags.propose", { flagKey: "nope", expectedVersion: 0, newValue: true }), 404, "NOT_FOUND");
    expectError(await call(dual, "POST", "/api/actions/flags.propose", { flagKey: KEY, expectedVersion: 7, newValue: true }), 409, "STALE_VERSION");
    expectError(await call(dual, "POST", "/api/actions/flags.propose", { flagKey: KEY, expectedVersion: 0, newValue: true, force: true }), 422, "VALIDATION");
  });
});

describe("F3 maker-checker publish", () => {
  let requestId: string;

  it("dual proposes; a second proposal for the same flag version is a duplicate", async () => {
    const r = await call(dual, "POST", "/api/actions/flags.propose", { flagKey: KEY, expectedVersion: 0, newValue: true });
    expect(r.status).toBe(200);
    const acc = ActionAccepted.parse(r.json);
    requestId = acc.requestId;
    expect(acc.request.kind).toBe("flag_change");
    expect(acc.request.decision).toBe("PENDING");
    expect(acc.request.execution).toBe("NONE");
    expect((await flag(dual, KEY)).pendingRequestId).toBe(requestId);
    expectError(await call(dual, "POST", "/api/actions/flags.propose", { flagKey: KEY, expectedVersion: 0, newValue: false }), 409, "DUPLICATE_REQUEST");
  });

  it("requester cannot approve own proposal; agent lacks flags.review", async () => {
    expectError(await call(dual, "POST", "/api/actions/approvals.decide", { requestId, decision: "approve" }), 403, "SELF_APPROVAL");
    expectError(await call(agent, "POST", "/api/actions/approvals.decide", { requestId, decision: "approve" }), 403, "FORBIDDEN");
    expect((await flag(dual, KEY)).value).toBe(false);
  });

  it("independent reviewer approves -> value flips, version increments, in one transaction", async () => {
    const r = await call(reviewer, "POST", "/api/actions/approvals.decide", { requestId, decision: "approve" });
    expect(r.status).toBe(200);
    const f = await flag(agent, KEY);
    expect(f.value).toBe(true);
    expect(f.version).toBe(1);
    expect(f.updatedById).toBe("u_reviewer");
    expect(f.pendingRequestId).toBeNull();
    const d = ApprovalResponse.parse((await call(reviewer, "GET", `/api/approvals/${requestId}`)).json);
    expect(d.decision).toBe("APPROVED");
    expectError(await call(reviewer, "POST", "/api/actions/approvals.decide", { requestId, decision: "reject" }), 409, "ALREADY_DECIDED");
  });

  it("a proposal naming the old version is now stale; the new version can be proposed", async () => {
    expectError(await call(dual, "POST", "/api/actions/flags.propose", { flagKey: KEY, expectedVersion: 0, newValue: false }), 409, "STALE_VERSION");
    const r = await call(dual, "POST", "/api/actions/flags.propose", { flagKey: KEY, expectedVersion: 1, newValue: false });
    expect(r.status).toBe(200);
    const rej = await call(reviewer, "POST", "/api/actions/approvals.decide", { requestId: ActionAccepted.parse(r.json).requestId, decision: "reject" });
    expect(rej.status).toBe(200);
    const f = await flag(agent, KEY);
    expect(f.value).toBe(true);
    expect(f.version).toBe(1);
  });

  it("audit trail: propose, decide, publish — all present, all PII-free, readable only with audit.read", async () => {
    expectError(await call(dual, "GET", `/api/audit?requestId=${requestId}`), 403, "FORBIDDEN");
    const events = AuditResponse.parse((await call(auditor, "GET", `/api/audit?requestId=${requestId}`)).json).events;
    const actions = events.filter((e) => e.outcome === "ok").map((e) => e.action);
    expect(actions).toEqual(["flags.propose", "approvals.decide", "flags.published"]);
    for (const e of events) expect(e.summary).not.toMatch(/@/);
  });
});
