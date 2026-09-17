import { RefundPayload } from "@tools/contracts";
import type { Executor } from "@tools/server-core";

const HTTP_TIMEOUT_MS = 3_000;

/** Calls the payment provider (simulator in this prototype). Idempotent on the job's key, so retries are safe. */
export const refundExecutor: Executor = {
  kind: "refund",
  async execute({ job, payload: raw }, env) {
    const baseUrl = env.PAYMENT_SIMULATOR_URL ?? "http://localhost:4100";
    const payload = RefundPayload.parse(raw);
    const res = await fetch(`${baseUrl}/refunds`, {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": job.idempotency_key },
      body: JSON.stringify({ paymentId: payload.paymentId, amountMinor: payload.amountMinor, currency: payload.currency }),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    if (res.status !== 200 && res.status !== 201) throw new Error(`payment provider returned ${res.status}`);
    const body = (await res.json()) as { providerRef?: unknown };
    if (typeof body.providerRef !== "string") throw new Error("payment provider response missing providerRef");
    return { providerRef: body.providerRef };
  },
};
