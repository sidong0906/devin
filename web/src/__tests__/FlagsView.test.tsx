import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DEMO_USERS, SEED_FLAGS } from "@tools/contracts";
import type { FlagDto } from "@tools/contracts";
import { FlagsView } from "../apps/flags/FlagsView";
import { apiError, json, mockFetch } from "./helpers";

afterEach(cleanup);

const flags = (version: number): FlagDto[] =>
  SEED_FLAGS.map((f) => ({ key: f.key, value: f.value, version, updatedAt: "2026-09-15T09:00:00Z", updatedById: null, pendingRequestId: null }));

describe("FlagsView", () => {
  it("hides the propose button without flags.propose", async () => {
    mockFetch((_m, path) => (path === "/api/flags" ? json({ flags: flags(0) }) : undefined));
    render(<FlagsView actor={DEMO_USERS.reviewer} onNavigate={() => {}} />);
    await screen.findByText(SEED_FLAGS[0].key);
    expect(screen.queryByRole("button", { name: /Propose/ })).toBeNull();
    expect(screen.getByText(/cannot propose changes/)).toBeTruthy();
  });

  it("sends the loaded version as expectedVersion and renders 409 STALE_VERSION as a refresh prompt", async () => {
    let serverVersion = 0;
    const { calls } = mockFetch((method, path) => {
      if (path === "/api/flags") return json({ flags: flags(serverVersion) });
      if (method === "POST" && path === "/api/actions/flags.propose") {
        serverVersion = 1;
        return apiError("STALE_VERSION", "flag refunds.instant_small_amounts is at version 1, expected 0");
      }
      return undefined;
    });
    render(<FlagsView actor={DEMO_USERS.dual} onNavigate={() => {}} />);
    await screen.findByText(SEED_FLAGS[0].key);
    fireEvent.click(screen.getAllByRole("button", { name: /Propose/ })[0] as HTMLButtonElement);
    const box = await screen.findByTestId("stale-version");
    expect(box.textContent).toContain("Flag changed since you loaded it — refresh.");
    expect(box.textContent).toContain("409 STALE_VERSION");
    const propose = calls.find((c) => c.method === "POST");
    expect(propose?.body).toEqual({ flagKey: SEED_FLAGS[0].key, expectedVersion: 0, newValue: !SEED_FLAGS[0].value });
    await waitFor(() => expect(screen.getAllByText("v1").length).toBeGreaterThan(0));
  });
});
