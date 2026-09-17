import { createHash, randomBytes } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";

const RefundBody = z.object({ paymentId: z.string().min(1), amountMinor: z.number().int().positive(), currency: z.string().min(1) }).strict();
const FaultBody = z.object({ mode: z.enum(["drop_response_once"]) }).strict();

export interface Effect {
  providerRef: string;
  idempotencyKey: string;
  paymentId: string;
  amountMinor: number;
  currency: string;
  createdAt: string;
}

export interface SimulatorStore {
  effects: Map<string, { fingerprint: string; effect: Effect }>;
  faults: { dropResponseOnce: boolean };
}

export function createStore(): SimulatorStore {
  return { effects: new Map(), faults: { dropResponseOnce: false } };
}

export function fingerprint(body: z.infer<typeof RefundBody>): string {
  return createHash("sha256").update(JSON.stringify([body.paymentId, body.amountMinor, body.currency])).digest("hex");
}

export type ApplyResult = { kind: "created"; effect: Effect } | { kind: "replayed"; effect: Effect } | { kind: "mismatch" };

/** Atomic (single-threaded) idempotent apply: same key + same body replays, same key + different body is rejected. */
export function applyRefund(store: SimulatorStore, key: string, body: z.infer<typeof RefundBody>): ApplyResult {
  const fp = fingerprint(body);
  const existing = store.effects.get(key);
  if (existing) return existing.fingerprint === fp ? { kind: "replayed", effect: existing.effect } : { kind: "mismatch" };
  const effect: Effect = {
    providerRef: `re_${randomBytes(8).toString("hex")}`,
    idempotencyKey: key,
    paymentId: body.paymentId,
    amountMinor: body.amountMinor,
    currency: body.currency,
    createdAt: new Date().toISOString(),
  };
  store.effects.set(key, { fingerprint: fp, effect });
  return { kind: "created", effect };
}

export function buildSimulator(store: SimulatorStore = createStore()): FastifyInstance {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });

  app.setErrorHandler((err, request, reply) => {
    if (err instanceof z.ZodError) return reply.status(422).send({ code: "VALIDATION", message: "invalid body" });
    const e = err as { statusCode?: number; message?: string };
    const status = typeof e.statusCode === "number" && e.statusCode >= 400 && e.statusCode < 500 ? e.statusCode : 500;
    return reply.status(status).send({ code: status === 500 ? "INTERNAL" : "VALIDATION", message: status === 500 ? "internal error" : e.message ?? "bad request" });
  });

  app.get("/health", async () => ({ ok: true }));

  app.post("/refunds", async (request, reply) => {
    const key = request.headers["idempotency-key"];
    if (typeof key !== "string" || !key) return reply.status(422).send({ code: "VALIDATION", message: "Idempotency-Key header required" });
    const body = RefundBody.parse(request.body ?? {});
    const result = applyRefund(store, key, body);
    if (result.kind === "mismatch") return reply.status(422).send({ code: "IDEMPOTENCY_MISMATCH", message: "same key with different body" });
    if (store.faults.dropResponseOnce) {
      store.faults.dropResponseOnce = false;
      // Effect is recorded, but the response never arrives: hijack the reply and never write to the socket.
      reply.hijack();
      const socket = request.raw.socket;
      setTimeout(() => socket.destroy(), 30_000).unref();
      return reply;
    }
    return reply.status(result.kind === "created" ? 201 : 200).send(result.effect);
  });

  app.post("/__test/reset", async () => {
    store.effects.clear();
    store.faults.dropResponseOnce = false;
    return { ok: true };
  });
  app.get("/__test/effects", async () => ({ effects: [...store.effects.values()].map((e) => e.effect) }));
  app.post("/__test/fault", async (request) => {
    const body = FaultBody.parse(request.body ?? {});
    if (body.mode === "drop_response_once") store.faults.dropResponseOnce = true;
    return { ok: true, faults: store.faults };
  });

  return app;
}
