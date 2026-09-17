import { describe, expect, it } from "vitest";
import { ApprovalRequestDto, AuditEventDto, SEED_PAYMENTS } from "@tools/contracts";
import { registerRequestSummary, requestSummary, toApprovalRequestDto, toAuditEventDto } from "./dto.js";
import { buildSummary } from "./audit.js";

const seed = SEED_PAYMENTS[0];

describe("dto mapping", () => {
  it("falls back to a kind-only summary until an app registers one", () => {
    const payload = { kind: "flag_change" as const, flagKey: "ui.new_dashboard", expectedVersion: 0, newValue: true };
    expect(requestSummary(payload)).toBe("kind=flag_change");
    registerRequestSummary("flag_change", (p) => buildSummary({ kind: p.kind, reason: `${p.flagKey}->${p.newValue}` }));
    expect(requestSummary(payload)).toBe("kind=flag_change reason=ui.new_dashboard->true");
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
