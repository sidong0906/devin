import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DEMO_USERS } from "@tools/contracts";
import { App } from "../App";
import { apiError, json, mockFetch } from "./helpers";

afterEach(cleanup);

describe("identity switch", () => {
  it("calls demo session then /api/me and renders permission chips", async () => {
    let session: "agent" | "reviewer" | null = null;
    const { calls } = mockFetch((method, path, body) => {
      if (method === "POST" && path === "/api/demo/session") {
        session = (body as { user: "agent" | "reviewer" }).user;
        return json({ ok: true });
      }
      if (path === "/api/me") return session ? json(DEMO_USERS[session]) : apiError("UNAUTHENTICATED", "no session");
      if (path === "/api/refunds/payments") return json({ payments: [] });
      return undefined;
    });

    render(<App />);
    expect(screen.getByText("DEMO AUTH — synthetic identities")).toBeTruthy();
    await screen.findByText("Select a demo identity above to load data.");

    fireEvent.change(screen.getByLabelText("Demo identity"), { target: { value: "reviewer" } });

    await waitFor(() => expect(screen.getByTestId("actor-name").textContent).toBe("Raj Reviewer"));
    const chips = screen.getByTestId("permission-chips");
    for (const p of DEMO_USERS.reviewer.permissions) expect(chips.textContent).toContain(p);
    expect(chips.querySelectorAll(".chip").length).toBe(DEMO_USERS.reviewer.permissions.length);

    const sessionCall = calls.find((c) => c.path === "/api/demo/session");
    expect(sessionCall?.body).toEqual({ user: "reviewer" });
    expect(calls.findIndex((c) => c.path === "/api/demo/session")).toBeLessThan(calls.map((c) => c.path).lastIndexOf("/api/me"));
  });
});
