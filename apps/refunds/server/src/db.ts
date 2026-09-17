import type { Kysely, Selectable, Transaction } from "kysely";
import { PaymentDto as PaymentDtoSchema, maskEmail, type PaymentDto } from "@tools/contracts";
import { iso, type Database, type Db, type Tx } from "@tools/server-core";

export interface PaymentsTable {
  id: string;
  amount_minor: number;
  currency: string;
  customer_email: string;
  captured_at: Date;
}
export type PaymentRow = Selectable<PaymentsTable>;

type RefundsDatabase = Database & { payments: PaymentsTable };
export type RefundsDb = Kysely<RefundsDatabase>;
export type RefundsTx = Transaction<RefundsDatabase>;

export function refundsDb(db: Db): RefundsDb {
  return db.withTables<{ payments: PaymentsTable }>();
}

export function refundsTx(tx: Tx): RefundsTx {
  return tx.withTables<{ payments: PaymentsTable }>();
}

export function refundSubjectKey(paymentId: string): string {
  return `refund:${paymentId}`;
}

export function refundIdempotencyKey(requestId: string): string {
  return `refund:${requestId}`;
}

export function toPaymentDto(row: PaymentRow, refundRequestId: string | null): PaymentDto {
  return PaymentDtoSchema.parse({
    id: row.id,
    amountMinor: row.amount_minor,
    currency: row.currency,
    customerEmailMasked: maskEmail(row.customer_email),
    capturedAt: iso(row.captured_at),
    refundRequestId,
  });
}
