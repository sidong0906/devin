import { describe, expect, it } from "vitest";
import { APPS, executorsByKind } from "./index.js";

describe("app manifest", () => {
  it("lists uniquely named apps with the platform hooks", () => {
    const names = APPS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
    for (const app of APPS) {
      expect(typeof app.register).toBe("function");
      expect(typeof app.registerRoutes).toBe("function");
    }
  });

  it("maps request kinds to at most one executor", () => {
    const executors = executorsByKind();
    expect(executors.get("refund")?.kind).toBe("refund");
    expect(() => executorsByKind([...APPS, APPS[0]!])).toThrow(/registered twice/);
  });
});
