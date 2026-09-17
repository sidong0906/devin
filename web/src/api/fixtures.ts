import { DEMO_USERS, DemoUserKey, HTTP_STATUS, SEED_FLAGS, SEED_PAYMENTS, maskEmail } from "@tools/contracts";
import type { Actor, ApprovalRequestDto, AuditEventDto, ErrorCode, FlagDto, PaymentDto } from "@tools/contracts";

/**
 * Deterministic in-memory stand-in for the API, used ONLY when VITE_USE_FIXTURES=1.
 * Mirrors the contract's status codes and error shape so the UI exercises the same paths.
 */
export function createFixtureFetch(): typeof fetch {
  let session: DemoUserKey | null = null;
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}_${String(++seq).padStart(4, "0")}`;
  const now = () => new Date().toISOString();

  const payments: PaymentDto[] = SEED_PAYMENTS.map((p) => ({
    id: p.id,
    amountMinor: p.amountMinor,
    currency: p.currency,
    customerEmailMasked: maskEmail(p.customerEmail),
    capturedAt: p.capturedAt,
    refundRequestId: null,
  }));
  const flags: FlagDto[] = SEED_FLAGS.map((f) => ({
    key: f.key,
    value: f.value,
    version: 0,
    updatedAt: "2026-09-15T09:00:00Z",
    updatedById: null,
    pendingRequestId: null,
  }));
  const requests: ApprovalRequestDto[] = [];
  const audit: AuditEventDto[] = [];

  function addAudit(actorId: string, action: string, requestId: string, outcome: AuditEventDto["outcome"], summary: string) {
    audit.push({ id: audit.length + 1, at: now(), actorId, action, objectId: requestId, requestId, outcome, summary });
  }

  function createRequest(actor: Actor, payment: PaymentDto): ApprovalRequestDto {
    const id = nextId("req");
    const req: ApprovalRequestDto = {
      id,
      kind: "refund",
      requesterId: actor.id,
      requesterName: actor.displayName,
      summary: `Full refund of ${(payment.amountMinor / 100).toFixed(2)} ${payment.currency} for ${payment.id}`,
      payload: { kind: "refund", paymentId: payment.id, amountMinor: payment.amountMinor, currency: "USD", customerRef: payment.customerEmailMasked },
      decision: "PENDING",
      decidedById: null,
      decidedAt: null,
      execution: "NONE",
      executionResult: null,
      createdAt: now(),
    };
    requests.push(req);
    payment.refundRequestId = id;
    addAudit(actor.id, "refunds.request", id, "ok", req.summary);
    return req;
  }

  function createFlagRequest(actor: Actor, flag: FlagDto, newValue: boolean): ApprovalRequestDto {
    const id = nextId("req");
    const req: ApprovalRequestDto = {
      id,
      kind: "flag_change",
      requesterId: actor.id,
      requesterName: actor.displayName,
      summary: `kind=flag_change reason=${flag.key}->${newValue}`,
      payload: { kind: "flag_change", flagKey: flag.key, expectedVersion: flag.version, newValue },
      decision: "PENDING",
      decidedById: null,
      decidedAt: null,
      execution: "NONE",
      executionResult: null,
      createdAt: now(),
    };
    requests.push(req);
    flag.pendingRequestId = id;
    addAudit(actor.id, "flags.propose", id, "ok", `kind=flag_change flag=${flag.key} from=${flag.value} to=${newValue} v=${flag.version}`);
    return req;
  }

  function publishFlag(req: ApprovalRequestDto, deciderId: string) {
    const payload = req.payload;
    if (payload.kind !== "flag_change") return;
    const flag = flags.find((f) => f.key === payload.flagKey);
    if (!flag) return;
    flag.value = payload.newValue;
    flag.version += 1;
    flag.updatedById = deciderId;
    flag.updatedAt = now();
    flag.pendingRequestId = null;
    addAudit(deciderId, "flags.published", req.id, "ok", `kind=flag_change flag=${flag.key} value=${flag.value} v=${flag.version}`);
  }

  // Seed one pending request of each kind so the approvals queue is not empty on first load.
  const seededPayment = payments[1];
  if (seededPayment) createRequest(DEMO_USERS.agent, seededPayment);
  const seededFlag = flags[2];
  if (seededFlag) createFlagRequest(DEMO_USERS.dual, seededFlag, true);

  function scheduleExecution(req: ApprovalRequestDto) {
    req.execution = "QUEUED";
    req.executionResult = { providerRef: null, attempts: 0, lastError: null };
    const flaky = req.payload.kind === "refund" && req.payload.paymentId === "pay_1003";
    setTimeout(() => {
      req.execution = "LEASED";
      req.executionResult = { providerRef: null, attempts: 1, lastError: null };
    }, 1200);
    setTimeout(() => {
      if (flaky) {
        req.execution = "RETRY_WAIT";
        req.executionResult = { providerRef: null, attempts: 1, lastError: "simulator response lost (timeout)" };
        addAudit("system:worker", "execution.retry", req.id, "failed", "attempt 1 timed out; retry scheduled");
      } else {
        req.execution = "SUCCEEDED";
        req.executionResult = { providerRef: `sim_${req.id}`, attempts: 1, lastError: null };
        addAudit("system:worker", "execution.succeeded", req.id, "ok", `refund executed, providerRef sim_${req.id}`);
      }
    }, 2600);
    if (flaky) {
      setTimeout(() => {
        req.execution = "NEEDS_REVIEW";
        req.executionResult = { providerRef: null, attempts: 2, lastError: "unresolved outcome after retry; manual reconciliation required" };
        addAudit("system:worker", "execution.needs_review", req.id, "failed", "outcome unresolved after 2 attempts");
      }, 4200);
    }
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const error = (code: ErrorCode, message: string) => json({ code, message, requestId: nextId("fx") }, HTTP_STATUS[code]);

  const actor = (): Actor | null => (session ? DEMO_USERS[session] : null);
  const has = (a: Actor, p: Actor["permissions"][number]) => a.permissions.includes(p);

  async function handle(method: string, url: URL, rawBody: string | null): Promise<Response> {
    const path = url.pathname;
    let body: unknown = null;
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        return error("VALIDATION", "Body is not valid JSON");
      }
    }

    if (method === "POST" && path === "/api/demo/session") {
      const key = DemoUserKey.safeParse((body as { user?: unknown } | null)?.user);
      if (!key.success) return error("VALIDATION", "Unknown demo user");
      session = key.data;
      return json({ ok: true });
    }

    const me = actor();
    if (!me) return error("UNAUTHENTICATED", "No session cookie");

    if (method === "GET" && path === "/api/me") return json(me);
    if (method === "GET" && path === "/api/refunds/payments") return json({ payments });

    if (method === "POST" && path === "/api/actions/refunds.request") {
      if (!has(me, "refunds.request")) return error("FORBIDDEN", "Action refunds.request requires permission refunds.request");
      const paymentId = (body as { paymentId?: unknown } | null)?.paymentId;
      if (typeof paymentId !== "string") return error("VALIDATION", "paymentId is required");
      const payment = payments.find((p) => p.id === paymentId);
      if (!payment) return error("NOT_FOUND", `Payment ${paymentId} not found`);
      if (payment.refundRequestId) return error("DUPLICATE_REQUEST", `Payment ${paymentId} already has refund request ${payment.refundRequestId}`);
      const req = createRequest(me, payment);
      return json({ requestId: req.id, request: req });
    }

    if (method === "GET" && path === "/api/approvals") {
      if (!has(me, "approvals.read")) return error("FORBIDDEN", "approvals.read required");
      return json({ requests: [...requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
    }

    const detail = /^\/api\/approvals\/([^/]+)$/.exec(path);
    if (method === "GET" && detail) {
      if (!has(me, "approvals.read")) return error("FORBIDDEN", "approvals.read required");
      const req = requests.find((r) => r.id === decodeURIComponent(detail[1] ?? ""));
      if (!req) return error("NOT_FOUND", "Request not found");
      return json(req);
    }

    if (method === "POST" && path === "/api/actions/approvals.decide") {
      const b = body as { requestId?: unknown; decision?: unknown } | null;
      if (typeof b?.requestId !== "string" || (b.decision !== "approve" && b.decision !== "reject")) {
        return error("VALIDATION", "requestId and decision (approve|reject) are required");
      }
      const req = requests.find((r) => r.id === b.requestId);
      if (!req) return error("NOT_FOUND", "Request not found");
      const needed = req.kind === "refund" ? "refunds.review" : "flags.review";
      if (!has(me, needed)) {
        addAudit(me.id, "approvals.decide", req.id, "denied", `missing permission ${needed}`);
        return error("FORBIDDEN", `Action approvals.decide on kind ${req.kind} requires permission ${needed}`);
      }
      if (req.requesterId === me.id) {
        addAudit(me.id, "approvals.decide", req.id, "denied", "self-approval blocked (maker-checker)");
        return error("SELF_APPROVAL", "Requester cannot decide their own request");
      }
      if (req.decision !== "PENDING") return error("ALREADY_DECIDED", `Request already ${req.decision} by ${req.decidedById ?? "unknown"}`);
      req.decision = b.decision === "approve" ? "APPROVED" : "REJECTED";
      req.decidedById = me.id;
      req.decidedAt = now();
      addAudit(me.id, "approvals.decide", req.id, "ok", `${req.decision.toLowerCase()} ${req.summary}`);
      if (req.kind === "flag_change") {
        if (req.decision === "APPROVED") publishFlag(req, me.id);
        else {
          const flag = flags.find((f) => f.key === (req.payload.kind === "flag_change" ? req.payload.flagKey : ""));
          if (flag) flag.pendingRequestId = null;
        }
      } else if (req.decision === "APPROVED") scheduleExecution(req);
      return json({ requestId: req.id, request: req });
    }

    if (method === "GET" && path === "/api/flags") return json({ flags });

    if (method === "POST" && path === "/api/actions/flags.propose") {
      if (!has(me, "flags.propose")) return error("FORBIDDEN", "Action flags.propose requires permission flags.propose");
      const b = body as { flagKey?: unknown; expectedVersion?: unknown; newValue?: unknown } | null;
      if (typeof b?.flagKey !== "string" || typeof b.expectedVersion !== "number" || typeof b.newValue !== "boolean") {
        return error("VALIDATION", "flagKey, expectedVersion and newValue are required");
      }
      const flag = flags.find((f) => f.key === b.flagKey);
      if (!flag) return error("NOT_FOUND", `Flag ${b.flagKey} not found`);
      if (flag.version !== b.expectedVersion) return error("STALE_VERSION", `flag ${flag.key} is at version ${flag.version}, expected ${b.expectedVersion}`);
      if (flag.pendingRequestId) return error("DUPLICATE_REQUEST", `a change is already proposed for flag ${flag.key} v${flag.version}`);
      const req = createFlagRequest(me, flag, b.newValue);
      return json({ requestId: req.id, request: req });
    }

    if (method === "GET" && path === "/api/audit") {
      if (!has(me, "audit.read")) return error("FORBIDDEN", "audit.read required");
      const requestId = url.searchParams.get("requestId");
      const events = requestId ? audit.filter((e) => e.requestId === requestId) : audit;
      return json({ events });
    }

    return error("NOT_FOUND", `No route for ${method} ${path}`);
  }

  return async (input, init) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(href, "http://fixtures.local");
    const method = (init?.method ?? "GET").toUpperCase();
    const rawBody = typeof init?.body === "string" ? init.body : null;
    await new Promise((r) => setTimeout(r, 120)); // make loading states visible
    return handle(method, url, rawBody);
  };
}
