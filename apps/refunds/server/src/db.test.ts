import { describe, expect, it } from "vitest";
import { PaymentDto, SEED_PAYMENTS } from "@tools/contracts";
import { toPaymentDto } from "./db.js";

const seed = SEED_PAYMENTS[0];

describe("refunds dto", () => {
  it("masks the payment email", () => {
    const dto = toPaymentDto(
      { id: seed.id, amount_minor: seed.amountMinor, currency: "USD", customer_email: seed.customerEmail, captured_at: new Date(seed.capturedAt) },
      null,
    );
    expect(PaymentDto.parse(dto)).toEqual(dto);
    expect(dto.customerEmailMasked).toBe("j***@example.com");
    expect(JSON.stringify(dto)).not.toContain(seed.customerEmail);
  });
});
