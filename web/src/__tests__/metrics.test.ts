import { describe, expect, it } from "vitest";
import type { ApprovalRequestDto } from "@tools/contracts";
import { countRequests, decisionSlices, executionSlices, medianDecisionMinutes, requesterSlices, requestsPerDay } from "../platform/metrics";
import { parseHash } from "../routes";

function req(over: Partial<ApprovalRequestDto>): ApprovalRequestDto {
  return {
    id: "req_x",
    kind: "refund",
    requesterId: "u_agent",
    requesterName: "Ana Agent",
    summary: "kind=refund",
    payload: { kind: "refund", paymentId: "pay_1", amountMinor: 100, currency: "USD", customerRef: "j***@example.com" },
    decision: "PENDING",
    decidedById: null,
    decidedAt: null,
    execution: "NONE",
    executionResult: null,
    createdAt: "2026-09-17T00:00:00Z",
    ...over,
  };
}

const sample = [
  req({ id: "a", decision: "PENDING" }),
  req({ id: "b", decision: "APPROVED", decidedAt: "2026-09-17T00:10:00Z", execution: "SUCCEEDED" }),
  req({ id: "c", decision: "APPROVED", decidedAt: "2026-09-17T00:30:00Z", execution: "NEEDS_REVIEW" }),
  req({ id: "d", decision: "REJECTED", decidedAt: "2026-09-17T00:02:00Z" }),
  req({ id: "e", kind: "flag_change", decision: "APPROVED", decidedAt: "2026-09-17T00:20:00Z", createdAt: "2026-09-15T12:00:00Z" }),
];

describe("metrics", () => {
  it("counts decisions and execution states without double counting", () => {
    expect(countRequests(sample)).toEqual({ total: 5, pending: 1, approved: 3, rejected: 1, succeeded: 1, inFlight: 0, needsReview: 1 });
  });

  it("groups by requester, largest first, with distinct categorical colours", () => {
    const slices = requesterSlices([...sample, req({ id: "f", requesterName: "Dana Dual" })]);
    expect(slices.map((s) => [s.label, s.value])).toEqual([["Ana Agent", 5], ["Dana Dual", 1]]);
    expect(new Set(slices.map((s) => s.color)).size).toBe(2);
  });

  it("keeps unresolved states on non-success tones", () => {
    const decision = Object.fromEntries(decisionSlices(sample).map((s) => [s.label, s.tone]));
    expect(decision).toEqual({ Pending: "pending", Approved: "ok", Rejected: "danger" });
    const exec = Object.fromEntries(executionSlices(sample).map((s) => [s.label, s.tone]));
    expect(exec["Needs review"]).toBe("warn");
    expect(exec["Succeeded"]).toBe("ok");
    expect(Object.values(exec).filter((t) => t === "ok")).toHaveLength(1);
  });

  it("buckets requests per UTC day, zero-filled, one column per kind", () => {
    const points = requestsPerDay(sample, ["refund", "flag_change"], 3, new Date("2026-09-17T15:00:00Z"));
    expect(points.map((p) => p.label)).toEqual(["Sep 15", "Sep 16", "Sep 17"]);
    expect(points[0]).toMatchObject({ refund: 0, flag_change: 1 });
    expect(points[2]).toMatchObject({ refund: 4, flag_change: 0 });
  });

  it("reports the median time to a decision, or null when nothing is decided", () => {
    expect(medianDecisionMinutes(sample)).toBe(20);
    expect(medianDecisionMinutes([req({})])).toBeNull();
  });
});

describe("parseHash", () => {
  it("routes the empty and unknown hashes to the overview", () => {
    expect(parseHash("")).toEqual({ name: "home" });
    expect(parseHash("#/")).toEqual({ name: "home" });
    expect(parseHash("#/nope")).toEqual({ name: "home" });
  });

  it("keeps approvals, request detail and app routes", () => {
    expect(parseHash("#/approvals")).toEqual({ name: "approvals" });
    expect(parseHash("#/approvals/req_1")).toEqual({ name: "request", id: "req_1" });
    expect(parseHash("#/payments")).toEqual({ name: "app", app: "refunds" });
    expect(parseHash("#/flags")).toEqual({ name: "app", app: "flags" });
  });
});
