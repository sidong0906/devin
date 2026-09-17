import { describe, expect, it } from "vitest";
import { ApprovalRequestDto, AuditEventDto, PaymentDto, SEED_PAYMENTS } from "@tools/contracts";
import { toApprovalRequestDto, toAuditEventDto, toPaymentDto } from "./dto.js";
import { buildSummary } from "./audit.js";

const seed = SEED_PAYMENTS[0];

describe("dto mapping", () => {
  it("masks the payment email", () => {
    const dto = toPaymentDto(
      { id: seed.id, amount_minor: seed.amountMinor, currency: "USD", customer_email: seed.customerEmail, captured_at: new Date(seed.capturedAt) },
      null,
    );
    expect(PaymentDto.parse(dto)).toEqual(dto);
    expect(dto.customerEmailMasked).toBe("j***@example.com");
    expect(JSON.stringify(dto)).not.toContain(seed.customerEmail);
  });

  it("maps request rows with and without jobs", () => {
    const row = {
      id: "req_1",
      kind: "refund",
      requester_id: "u_agent",
      payload: { kind: "refund", paymentId: seed.id, amountMinor: seed.amountMinor, currency: "USD", customerRef: "j***@example.com" },
      subject_key: "refund:pay_1001",
      decision: "APPROVED",
      decided_by_id: "u_reviewer",
      decided_at: new Date(),
      created_at: new Date(),
    };
    const none = toApprovalRequestDto(row, null);
    expect(ApprovalRequestDto.parse(none).execution).toBe("NONE");
    expect(none.executionResult).toBeNull();
    expect(none.requesterName).toBe("Ana Agent");
    const withJob = toApprovalRequestDto(row, { state: "SUCCEEDED", provider_ref: "re_1", attempts: 2, last_error: null });
    expect(withJob.execution).toBe("SUCCEEDED");
    expect(withJob.executionResult).toEqual({ providerRef: "re_1", attempts: 2, lastError: null });
  });

  it("maps audit rows and keeps summaries allowlisted", () => {
    const summary = buildSummary({ kind: "refund", customerRef: "j***@example.com", amountMinor: 4999, currency: "USD" });
    expect(summary).toBe("kind=refund customer=j***@example.com amount=4999 currency=USD");
    const dto = toAuditEventDto({
      id: 1,
      at: new Date(),
      actor_id: "system:worker",
      action: "execution.succeeded",
      object_id: "req_1",
      request_id: "req_1",
      outcome: "ok",
      summary,
    });
    expect(AuditEventDto.parse(dto)).toEqual(dto);
  });
});
