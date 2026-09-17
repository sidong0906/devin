import { describe, expect, it } from "vitest";
import { AppError, type ApprovalRequestRow, type Tx } from "@tools/server-core";
import { publishApprovedFlagChange } from "./index.js";

function fakeTx(flag: { key: string; value: boolean; version: number }) {
  const updates: unknown[] = [];
  const query = {
    selectAll: () => query,
    where: () => query,
    forUpdate: () => query,
    executeTakeFirst: async () => flag,
    set: (v: unknown) => {
      updates.push(v);
      return query;
    },
    execute: async () => [],
  };
  const tx = {
    withTables: () => tx,
    selectFrom: () => query,
    updateTable: () => query,
    insertInto: () => ({ values: () => query }),
  };
  return { tx: tx as unknown as Tx, updates };
}

const request: ApprovalRequestRow = {
  id: "req_1",
  kind: "flag_change",
  requester_id: "u_dual",
  payload: { kind: "flag_change", flagKey: "ui.new_dashboard", expectedVersion: 0, newValue: true },
  subject_key: "flag:ui.new_dashboard:v0",
  decision: "APPROVED",
  decided_by_id: "u_reviewer",
  decided_at: new Date(),
  created_at: new Date(),
};

describe("publishApprovedFlagChange", () => {
  it("throws STALE_VERSION when the flag version moved since the proposal", async () => {
    const { tx, updates } = fakeTx({ key: "ui.new_dashboard", value: false, version: 1 });
    await expect(publishApprovedFlagChange(tx, request)).rejects.toMatchObject({ code: "STALE_VERSION" });
    await expect(publishApprovedFlagChange(tx, request)).rejects.toBeInstanceOf(AppError);
    expect(updates).toHaveLength(0);
  });

  it("publishes with version + 1 and the decider as updated_by_id when versions match", async () => {
    const { tx, updates } = fakeTx({ key: "ui.new_dashboard", value: false, version: 0 });
    await publishApprovedFlagChange(tx, request);
    expect(updates[0]).toMatchObject({ value: true, version: 1, updated_by_id: "u_reviewer" });
  });
});
