import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { applyRefund, buildSimulator, createStore } from "./app.js";

const body = { paymentId: "pay_1001", amountMinor: 4999, currency: "USD" };

describe("applyRefund", () => {
  it("creates once, replays with the same providerRef, rejects mismatched bodies", () => {
    const store = createStore();
    const first = applyRefund(store, "k1", body);
    expect(first.kind).toBe("created");
    const second = applyRefund(store, "k1", body);
    expect(second.kind).toBe("replayed");
    if (first.kind !== "mismatch" && second.kind !== "mismatch") expect(second.effect.providerRef).toBe(first.effect.providerRef);
    expect(applyRefund(store, "k1", { ...body, amountMinor: 1 }).kind).toBe("mismatch");
    expect(store.effects.size).toBe(1);
  });
});

describe("simulator HTTP", () => {
  let app: FastifyInstance;
  beforeEach(async () => {
    app = buildSimulator();
    await app.ready();
  });
  afterEach(async () => {
    await app.close();
  });

  it("requires an Idempotency-Key and validates the body", async () => {
    const noKey = await app.inject({ method: "POST", url: "/refunds", payload: body });
    expect(noKey.statusCode).toBe(422);
    const badBody = await app.inject({ method: "POST", url: "/refunds", headers: { "idempotency-key": "k" }, payload: { paymentId: "x" } });
    expect(badBody.statusCode).toBe(422);
  });

  it("returns 201 then 200 for the same key and 422 for a different body", async () => {
    const a = await app.inject({ method: "POST", url: "/refunds", headers: { "idempotency-key": "k1" }, payload: body });
    expect(a.statusCode).toBe(201);
    const b = await app.inject({ method: "POST", url: "/refunds", headers: { "idempotency-key": "k1" }, payload: body });
    expect(b.statusCode).toBe(200);
    expect(b.json().providerRef).toBe(a.json().providerRef);
    const c = await app.inject({ method: "POST", url: "/refunds", headers: { "idempotency-key": "k1" }, payload: { ...body, amountMinor: 1 } });
    expect(c.statusCode).toBe(422);
    const effects = await app.inject({ method: "GET", url: "/__test/effects" });
    expect(effects.json().effects).toHaveLength(1);
  });

  it("reset clears effects and faults", async () => {
    await app.inject({ method: "POST", url: "/refunds", headers: { "idempotency-key": "k1" }, payload: body });
    await app.inject({ method: "POST", url: "/__test/fault", payload: { mode: "drop_response_once" } });
    await app.inject({ method: "POST", url: "/__test/reset" });
    const effects = await app.inject({ method: "GET", url: "/__test/effects" });
    expect(effects.json().effects).toHaveLength(0);
    const r = await app.inject({ method: "POST", url: "/refunds", headers: { "idempotency-key": "k2" }, payload: body });
    expect(r.statusCode).toBe(201);
  });

  it("drop_response_once records the effect but never responds; the retry replays it", async () => {
    await app.inject({ method: "POST", url: "/__test/fault", payload: { mode: "drop_response_once" } });
    const address = await app.listen({ port: 0, host: "127.0.0.1" });
    const dropped = fetch(`${address}/refunds`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "k1" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(300),
    });
    await expect(dropped).rejects.toThrow();
    const effects = await fetch(`${address}/__test/effects`).then((r) => r.json() as Promise<{ effects: unknown[] }>);
    expect(effects.effects).toHaveLength(1);
    const retry = await fetch(`${address}/refunds`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "k1" },
      body: JSON.stringify(body),
    });
    expect(retry.status).toBe(200);
    const after = await fetch(`${address}/__test/effects`).then((r) => r.json() as Promise<{ effects: unknown[] }>);
    expect(after.effects).toHaveLength(1);
  });
});
