import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DEMO_USERS, SEED_PAYMENTS, maskEmail } from "@tools/contracts";
import { PaymentsView } from "../components/PaymentsView";
import { apiError, json, mockFetch } from "./helpers";

afterEach(cleanup);

const payments = SEED_PAYMENTS.map((p) => ({
  id: p.id,
  amountMinor: p.amountMinor,
  currency: p.currency,
  customerEmailMasked: maskEmail(p.customerEmail),
  capturedAt: p.capturedAt,
  refundRequestId: p.id === "pay_1002" ? "req_0001" : null,
}));

describe("PaymentsView", () => {
  it("hides the request button without refunds.request", async () => {
    mockFetch((_m, path) => (path === "/api/refunds/payments" ? json({ payments }) : undefined));
    render(<PaymentsView actor={DEMO_USERS.reviewer} onNavigate={() => {}} />);
    await screen.findByText("$49.99");
    expect(screen.queryByRole("button", { name: /Request full refund/ })).toBeNull();
    expect(screen.getByText(/cannot request refunds/)).toBeTruthy();
  });

  it("shows the button with permission, disables it when a request exists, and renders masked emails", async () => {
    mockFetch((_m, path) => (path === "/api/refunds/payments" ? json({ payments }) : undefined));
    render(<PaymentsView actor={DEMO_USERS.agent} onNavigate={() => {}} />);
    await screen.findByText("$49.99");
    const buttons = screen.getAllByRole("button", { name: /Request full refund/ });
    expect(buttons.length).toBe(3);
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(true);
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText("j***@example.com")).toBeTruthy();
    expect(screen.queryByText("jordan.lee@example.com")).toBeNull();
  });

  it("renders a 409 DUPLICATE_REQUEST server error verbatim", async () => {
    mockFetch((method, path) => {
      if (path === "/api/refunds/payments") return json({ payments });
      if (method === "POST" && path === "/api/actions/refunds.request") return apiError("DUPLICATE_REQUEST", "Payment pay_1001 already has a refund request");
      return undefined;
    });
    render(<PaymentsView actor={DEMO_USERS.agent} onNavigate={() => {}} />);
    await screen.findByText("$49.99");
    fireEvent.click(screen.getAllByRole("button", { name: /Request full refund/ })[0] as HTMLButtonElement);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("409 DUPLICATE_REQUEST"));
    expect(screen.getByRole("alert").textContent).toContain("Payment pay_1001 already has a refund request");
  });
});
