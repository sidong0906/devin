import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DEMO_USERS } from "@tools/contracts";
import { RequestDetail } from "../platform/RequestDetail";
import { apiError, json, mockFetch, pendingRefund } from "./helpers";

afterEach(cleanup);

describe("RequestDetail", () => {
  it("renders 403 SELF_APPROVAL as an inline maker-checker message", async () => {
    const req = pendingRefund();
    mockFetch((method, path) => {
      if (path === "/api/approvals/req_0001") return json(req);
      if (method === "POST" && path === "/api/actions/approvals.decide") return apiError("SELF_APPROVAL", "Requester cannot decide their own request");
      return undefined;
    });
    render(<RequestDetail actor={DEMO_USERS.dual} requestId="req_0001" onNavigate={() => {}} />);
    await screen.findByRole("button", { name: "Approve" });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    const box = await screen.findByTestId("self-approval");
    expect(box.textContent).toContain("You requested this; a different reviewer must decide.");
    expect(box.textContent).toContain("SELF_APPROVAL");
    expect(box.textContent).toContain("Requester cannot decide their own request");
  });

  it("renders 409 ALREADY_DECIDED as a conflict and refreshes the record", async () => {
    let decided = false;
    mockFetch((method, path) => {
      if (path === "/api/approvals/req_0001") {
        return json(decided ? pendingRefund({ decision: "REJECTED", decidedById: "u_reviewer", decidedAt: "2026-09-15T10:05:00Z" }) : pendingRefund());
      }
      if (method === "POST" && path === "/api/actions/approvals.decide") {
        decided = true;
        return apiError("ALREADY_DECIDED", "Request already REJECTED by u_reviewer");
      }
      return undefined;
    });
    render(<RequestDetail actor={DEMO_USERS.reviewer} requestId="req_0001" onNavigate={() => {}} />);
    await screen.findByRole("button", { name: "Approve" });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    const conflict = await screen.findByTestId("conflict");
    expect(conflict.textContent).toContain("409 ALREADY_DECIDED");
    expect(conflict.textContent).toContain("Request already REJECTED by u_reviewer");
    await waitFor(() => expect(screen.getByText("u_reviewer")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.getAllByText("Rejected").length).toBeGreaterThan(0);
  });

  it("hides Approve/Reject without the review permission and shows audit gating", async () => {
    mockFetch((_m, path) => (path === "/api/approvals/req_0001" ? json(pendingRefund()) : undefined));
    render(<RequestDetail actor={DEMO_USERS.agent} requestId="req_0001" onNavigate={() => {}} />);
    await screen.findByText(/Deciding requires/);
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.getByText(/required — switch to an identity/).textContent).toContain("audit.read");
  });

  it("shows NEEDS_REVIEW as a warning, not success", async () => {
    mockFetch((_m, path) =>
      path === "/api/approvals/req_0001"
        ? json(pendingRefund({ decision: "APPROVED", decidedById: "u_reviewer", decidedAt: "2026-09-15T10:05:00Z", execution: "NEEDS_REVIEW", executionResult: { providerRef: null, attempts: 2, lastError: "unresolved" } }))
        : undefined,
    );
    render(<RequestDetail actor={DEMO_USERS.reviewer} requestId="req_0001" onNavigate={() => {}} />);
    await screen.findByText(/Needs manual review/);
    expect(screen.queryByText(/Executed exactly once/)).toBeNull();
    expect(screen.getByText("unresolved")).toBeTruthy();
  });
});
