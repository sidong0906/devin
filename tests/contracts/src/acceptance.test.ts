/**
 * Black-box acceptance gates G1–G8. Owned by the coordinator.
 * Runs against a live API + worker + simulator + PostgreSQL (see README "Run the gates").
 * Requires: API_URL (default http://localhost:4000), DATABASE_URL (app role), SIMULATOR_URL.
 * Each test authenticates via POST /api/demo/session and carries the cookie.
 */
import { describe, it, expect, beforeAll } from "vitest";
import pg from "pg";
import {
  ActionAccepted, ApiError, ApprovalResponse, ApprovalsResponse, AuditResponse, MeResponse, PaymentsResponse, SEED_PAYMENTS, SESSION_COOKIE,
  type DemoUserKey,
} from "@tools/contracts";

const API = process.env.API_URL ?? "http://localhost:4000";
const SIM = process.env.SIMULATOR_URL ?? "http://localhost:4100";
const DB = process.env.DATABASE_URL ?? "postgres://tools_app:tools_app@localhost:5432/tools";

type Session = { cookie: string };

async function login(user: DemoUserKey): Promise<Session> {
  const res = await fetch(`${API}/api/demo/session`, {
    method: "POST", headers: { "content-type": "application/json", origin: API }, body: JSON.stringify({ user }),
  });
  expect(res.status, `login ${user}`).toBe(200);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  expect(match, "session cookie set").not.toBeNull();
  expect(setCookie.toLowerCase()).toContain("httponly");
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
  const parsed = ApiError.parse(r.json);
  expect(parsed.code).toBe(code);
}

async function requestRefund(s: Session, paymentId: string) {
  const r = await call(s, "POST", "/api/actions/refunds.request", { paymentId });
  return r;
}

async function waitForExecution(s: Session, requestId: string, states: string[], timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await call(s, "GET", `/api/approvals/${requestId}`);
    const dto = ApprovalResponse.parse(r.json);
    if (states.includes(dto.execution)) return dto;
    await new Promise((res) => setTimeout(res, 250));
  }
  throw new Error(`timeout waiting for execution state in ${states.join("|")}`);
}

let db: pg.Client;
// Test-only reset endpoint keeps gates independent. Must be disabled outside demo mode.
async function resetWorld() {
  const r = await fetch(`${API}/api/demo/reset`, { method: "POST", headers: { origin: API } });
  expect(r.status, "demo reset").toBe(200);
  await fetch(`${SIM}/__test/reset`, { method: "POST" });
}

beforeAll(async () => {
  db = new pg.Client({ connectionString: DB });
  await db.connect();
  await resetWorld();
});

describe("G1 identity", () => {
  it("denies missing session", async () => {
    expectError(await call(null, "GET", "/api/me"), 401, "UNAUTHENTICATED");
    expectError(await call(null, "GET", "/api/approvals"), 401, "UNAUTHENTICATED");
  });
  it("ignores identity supplied in the request body", async () => {
    const agent = await login("agent");
    const r = await call(agent, "POST", "/api/actions/approvals.decide", { requestId: "x", decision: "approve", actorId: "u_reviewer" });
    // strict schema: unknown field is a validation error, never an identity override
    expectError(r, 422, "VALIDATION");
  });
  it("resolves the seeded actor and permissions server-side", async () => {
    const reviewer = await login("reviewer");
    const me = MeResponse.parse((await call(reviewer, "GET", "/api/me")).json);
    expect(me.id).toBe("u_reviewer");
    expect(me.permissions).toContain("refunds.review");
    expect(me.permissions).not.toContain("refunds.request");
  });
  it("demo reset is a demo-only endpoint (exists in demo mode)", async () => {
    // Production-startup refusal is covered by services/api unit test `prodGuard` (backend-owned).
    const r = await fetch(`${API}/api/demo/reset`, { method: "POST", headers: { origin: API } });
    expect(r.status).toBe(200);
  });
});

describe("G2 policy", () => {
  it("denies a role without the permission", async () => {
    const auditor = await login("auditor");
    expectError(await requestRefund(auditor, "pay_1001"), 403, "FORBIDDEN");
    const reviewer = await login("reviewer");
    expectError(await requestRefund(reviewer, "pay_1001"), 403, "FORBIDDEN");
  });
  it("denies unregistered actions", async () => {
    const dual = await login("dual");
    const r = await call(dual, "POST", "/api/actions/refunds.delete_everything", {});
    expect([403, 404]).toContain(r.status);
  });
  it("audit read requires audit.read", async () => {
    const agent = await login("agent");
    expectError(await call(agent, "GET", "/api/audit?requestId=x"), 403, "FORBIDDEN");
  });
});

describe("G3 maker-checker & G4 request integrity", () => {
  it("dual-role requester cannot approve own request; different reviewer can", async () => {
    await resetWorld();
    const dual = await login("dual");
    const created = ActionAccepted.parse((await requestRefund(dual, "pay_1001")).json);
    expect(created.request.decision).toBe("PENDING");
    expectError(await call(dual, "POST", "/api/actions/approvals.decide", { requestId: created.requestId, decision: "approve" }), 403, "SELF_APPROVAL");
    const reviewer = await login("reviewer");
    const decided = ActionAccepted.parse((await call(reviewer, "POST", "/api/actions/approvals.decide", { requestId: created.requestId, decision: "approve" })).json);
    expect(decided.request.decision).toBe("APPROVED");
    expect(decided.request.decidedById).toBe("u_reviewer");
  });
  it("amount/currency are server-derived and payload cannot be supplied", async () => {
    await resetWorld();
    const agent = await login("agent");
    expectError(await requestRefund(agent, "does_not_exist"), 404, "NOT_FOUND");
    const r = await call(agent, "POST", "/api/actions/refunds.request", { paymentId: "pay_1002", amountMinor: 1 });
    expectError(r, 422, "VALIDATION");
    const ok = ActionAccepted.parse((await requestRefund(agent, "pay_1002")).json);
    expect(ok.request.payload.kind).toBe("refund");
    if (ok.request.payload.kind === "refund") {
      expect(ok.request.payload.amountMinor).toBe(SEED_PAYMENTS[1].amountMinor);
      expect(ok.request.payload.customerRef).not.toContain("priya.n@example.com");
    }
  });
  it("one refund request per payment (even after rejection)", async () => {
    await resetWorld();
    const agent = await login("agent");
    const first = ActionAccepted.parse((await requestRefund(agent, "pay_1003")).json);
    expectError(await requestRefund(agent, "pay_1003"), 409, "DUPLICATE_REQUEST");
    const reviewer = await login("reviewer");
    await call(reviewer, "POST", "/api/actions/approvals.decide", { requestId: first.requestId, decision: "reject" });
    expectError(await requestRefund(agent, "pay_1003"), 409, "DUPLICATE_REQUEST");
  });
});

describe("G5 concurrency & G6 execution & G7 atomicity", () => {
  it("two simultaneous approvals -> one decision, one approval event, one job, one simulated effect", async () => {
    await resetWorld();
    const agent = await login("agent");
    const created = ActionAccepted.parse((await requestRefund(agent, "pay_1001")).json);
    const reviewer = await login("reviewer");
    const dual = await login("dual");
    const [a, b] = await Promise.all([
      call(reviewer, "POST", "/api/actions/approvals.decide", { requestId: created.requestId, decision: "approve" }),
      call(dual, "POST", "/api/actions/approvals.decide", { requestId: created.requestId, decision: "approve" }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
    const jobs = await db.query("select count(*)::int as n from execution_jobs where request_id = $1", [created.requestId]);
    expect(jobs.rows[0].n).toBe(1);
    const events = await db.query("select count(*)::int as n from audit_events where request_id = $1 and action = 'approvals.decide' and outcome = 'ok'", [created.requestId]);
    expect(events.rows[0].n).toBe(1);
    const final = await waitForExecution(reviewer, created.requestId, ["SUCCEEDED"]);
    expect(final.executionResult?.providerRef).toBeTruthy();
    const effects = await fetch(`${SIM}/__test/effects`).then((r) => r.json()) as { effects: unknown[] };
    expect(effects.effects.length).toBe(1);
  });
  it("lost simulator response + retry -> exactly one simulated effect", async () => {
    await resetWorld();
    // Ask the simulator to accept the next refund but drop the response once (test-only fault injection).
    await fetch(`${SIM}/__test/fault`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "drop_response_once" }) });
    const agent = await login("agent");
    const created = ActionAccepted.parse((await requestRefund(agent, "pay_1002")).json);
    const reviewer = await login("reviewer");
    await call(reviewer, "POST", "/api/actions/approvals.decide", { requestId: created.requestId, decision: "approve" });
    const final = await waitForExecution(reviewer, created.requestId, ["SUCCEEDED"], 30000);
    expect(final.executionResult?.attempts).toBeGreaterThanOrEqual(2);
    const effects = await fetch(`${SIM}/__test/effects`).then((r) => r.json()) as { effects: unknown[] };
    expect(effects.effects.length).toBe(1);
    const events = await db.query("select action, outcome from audit_events where request_id = $1 order by id", [created.requestId]);
    expect(events.rows.map((r: { action: string }) => r.action)).toContain("execution.succeeded");
  });
  it("rejection creates no execution job", async () => {
    await resetWorld();
    const agent = await login("agent");
    const created = ActionAccepted.parse((await requestRefund(agent, "pay_1003")).json);
    const reviewer = await login("reviewer");
    await call(reviewer, "POST", "/api/actions/approvals.decide", { requestId: created.requestId, decision: "reject" });
    const jobs = await db.query("select count(*)::int as n from execution_jobs where request_id = $1", [created.requestId]);
    expect(jobs.rows[0].n).toBe(0);
    expectError(await call(reviewer, "POST", "/api/actions/approvals.decide", { requestId: created.requestId, decision: "approve" }), 409, "ALREADY_DECIDED");
  });
  it("induced failure before commit leaves no partial state", async () => {
    await resetWorld();
    const agent = await login("agent");
    const created = ActionAccepted.parse((await requestRefund(agent, "pay_1001")).json);
    const reviewer = await login("reviewer");
    // Test-only header makes the decision transaction throw after writing but before commit.
    const r = await fetch(`${API}/api/actions/approvals.decide`, {
      method: "POST", headers: { "content-type": "application/json", origin: API, cookie: reviewer.cookie, "x-demo-fault": "throw_before_commit" },
      body: JSON.stringify({ requestId: created.requestId, decision: "approve" }),
    });
    expect(r.status).toBe(500);
    const row = await db.query("select decision from approval_requests where id = $1", [created.requestId]);
    expect(row.rows[0].decision).toBe("PENDING");
    const jobs = await db.query("select count(*)::int as n from execution_jobs where request_id = $1", [created.requestId]);
    expect(jobs.rows[0].n).toBe(0);
    const events = await db.query("select count(*)::int as n from audit_events where request_id = $1 and action = 'approvals.decide' and outcome = 'ok'", [created.requestId]);
    expect(events.rows[0].n).toBe(0);
  });
});

describe("G8 audit & privacy", () => {
  it("app role cannot UPDATE or DELETE audit rows, nor UPDATE request payload", async () => {
    await expect(db.query("update audit_events set summary = 'x' where id = (select min(id) from audit_events)")).rejects.toThrow(/permission denied/i);
    await expect(db.query("delete from audit_events where id = (select min(id) from audit_events)")).rejects.toThrow(/permission denied/i);
    await expect(db.query("update approval_requests set payload = '{}'::jsonb where id = (select min(id) from approval_requests)")).rejects.toThrow(/permission denied/i);
  });
  it("raw PII is absent from DTOs and audit summaries", async () => {
    const auditor = await login("auditor");
    const agent = await login("agent");
    const payments = PaymentsResponse.parse((await call(agent, "GET", "/api/refunds/payments")).json);
    for (const p of payments.payments) expect(p.customerEmailMasked).toMatch(/^.\*\*\*@/);
    const list = ApprovalsResponse.parse((await call(auditor, "GET", "/api/approvals")).json);
    const raw = SEED_PAYMENTS.map((p) => p.customerEmail);
    const text = JSON.stringify(list);
    for (const e of raw) expect(text).not.toContain(e);
    for (const req of list.requests) {
      const audit = AuditResponse.parse((await call(auditor, "GET", `/api/audit?requestId=${req.id}`)).json);
      const t = JSON.stringify(audit);
      for (const e of raw) expect(t).not.toContain(e);
      expect(audit.events.length).toBeGreaterThan(0);
    }
    const dbText = JSON.stringify((await db.query("select summary from audit_events")).rows);
    for (const e of raw) expect(dbText).not.toContain(e);
  });
});
