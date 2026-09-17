import { z } from "zod";

/** Server-derived, immutable once submitted. Amount in minor units (cents). */
export const RefundPayload = z.object({
  kind: z.literal("refund"),
  paymentId: z.string(),
  amountMinor: z.number().int().positive(),
  currency: z.literal("USD"),
  customerRef: z.string(), // masked in DTOs, never raw
});

/** Masked view of a seeded payment. Email is masked server-side. */
export const PaymentDto = z.object({
  id: z.string(),
  amountMinor: z.number().int(),
  currency: z.literal("USD"),
  customerEmailMasked: z.string(), // e.g. "j***@example.com"
  capturedAt: z.string(),
  refundRequestId: z.string().nullable(),
});
export type PaymentDto = z.infer<typeof PaymentDto>;

export const RefundRequestBody = z.object({ paymentId: z.string().min(1) }).strict();
export const PaymentsResponse = z.object({ payments: z.array(PaymentDto) });

export const REFUND_ROUTES = {
  payments: "GET /api/refunds/payments",
  refundRequest: "POST /api/actions/refunds.request",
} as const;

/** Seeded payments. Deterministic so UI fixtures and backend seeds agree. */
export const SEED_PAYMENTS = [
  { id: "pay_1001", amountMinor: 4999, currency: "USD", customerEmail: "jordan.lee@example.com", capturedAt: "2026-09-10T14:03:00Z" },
  { id: "pay_1002", amountMinor: 12900, currency: "USD", customerEmail: "priya.n@example.com", capturedAt: "2026-09-11T09:41:00Z" },
  { id: "pay_1003", amountMinor: 250, currency: "USD", customerEmail: "sam.okafor@example.com", capturedAt: "2026-09-12T18:20:00Z" },
] as const;
