import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { ActionName, Permission, type Actor } from "@tools/contracts";
import { authorizeAction, clearActionsForTest, listActions, registerAction } from "./actions.js";
import { AppError } from "./errors.js";

const agent: Actor = { id: "u_agent", displayName: "Ana", permissions: ["refunds.request", "approvals.read"] };
const dual: Actor = { id: "u_dual", displayName: "Dana", permissions: [...Permission.options] };

describe("action registry", () => {
  beforeEach(() => {
    clearActionsForTest();
    registerAction({ name: "refunds.request", permission: "refunds.request", body: z.object({ paymentId: z.string() }), handler: async () => ({}) });
    registerAction({ name: "approvals.decide", permission: "approvals.read", body: z.object({ requestId: z.string() }), handler: async () => ({}) });
  });

  it("every registered action declares a valid permission and a valid name", () => {
    const actions = listActions();
    expect(actions.length).toBeGreaterThan(0);
    for (const a of actions) {
      expect(Permission.safeParse(a.permission).success, `${a.name} permission`).toBe(true);
      expect(ActionName.safeParse(a.name).success, `${a.name} name`).toBe(true);
      expect(a.body).toBeDefined();
    }
  });

  it("denies unregistered names even for a fully-privileged actor", () => {
    expect(() => authorizeAction(dual, "refunds.delete_everything")).toThrow(AppError);
    try {
      authorizeAction(dual, "flags.propose");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("NOT_FOUND");
    }
  });

  it("denies an actor without the declared permission", () => {
    const auditor: Actor = { id: "u_auditor", displayName: "Avery", permissions: ["approvals.read", "audit.read"] };
    expect(() => authorizeAction(auditor, "refunds.request")).toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    expect(authorizeAction(agent, "refunds.request").permission).toBe("refunds.request");
  });

  it("refuses duplicate registrations", () => {
    expect(() =>
      registerAction({ name: "refunds.request", permission: "refunds.request", body: z.object({}), handler: async () => ({}) }),
    ).toThrow(/already registered/);
  });
});
