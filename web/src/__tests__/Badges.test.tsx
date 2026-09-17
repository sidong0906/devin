import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ExecutionState } from "@tools/contracts";
import { ExecutionBadge } from "../platform/Badges";

afterEach(cleanup);

describe("ExecutionBadge", () => {
  it("maps every ExecutionState to a distinct, non-empty label", () => {
    const labels = new Map<string, string>();
    for (const state of ExecutionState.options) {
      const { container, unmount } = render(<ExecutionBadge state={state} />);
      const el = container.querySelector(".badge");
      expect(el, state).not.toBeNull();
      expect(el?.getAttribute("data-state")).toBe(state);
      expect(el?.textContent?.trim().length ?? 0, state).toBeGreaterThan(0);
      labels.set(state, el?.textContent ?? "");
      unmount();
    }
    expect(new Set(labels.values()).size).toBe(ExecutionState.options.length);
    expect(labels.get("NEEDS_REVIEW")).not.toMatch(/succeed/i);
  });

  it("uses a warning tone for NEEDS_REVIEW and success tone only for SUCCEEDED", () => {
    const { container } = render(
      <>
        <ExecutionBadge state="NEEDS_REVIEW" />
        <ExecutionBadge state="SUCCEEDED" />
      </>,
    );
    expect(container.querySelector('[data-state="NEEDS_REVIEW"]')?.className).toContain("badge-warn");
    expect(container.querySelector('[data-state="SUCCEEDED"]')?.className).toContain("badge-ok");
    expect(container.querySelectorAll(".badge-ok").length).toBe(1);
  });
});
