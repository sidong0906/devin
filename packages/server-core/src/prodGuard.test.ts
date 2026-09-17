import { describe, expect, it } from "vitest";
import { assertDemoAuthAllowed, isDemoMode } from "./identity.js";

describe("assertDemoAuthAllowed", () => {
  it("refuses production startup with demo auth enabled", () => {
    expect(() => assertDemoAuthAllowed({ DEMO_AUTH: "true", NODE_ENV: "production" })).toThrow(/not allowed/);
  });
  it("allows demo auth outside production", () => {
    expect(() => assertDemoAuthAllowed({ DEMO_AUTH: "true", NODE_ENV: "development" })).not.toThrow();
    expect(() => assertDemoAuthAllowed({ DEMO_AUTH: "true", NODE_ENV: "test" })).not.toThrow();
    expect(() => assertDemoAuthAllowed({ DEMO_AUTH: "true" })).not.toThrow();
  });
  it("allows production when demo auth is off", () => {
    expect(() => assertDemoAuthAllowed({ DEMO_AUTH: "false", NODE_ENV: "production" })).not.toThrow();
    expect(() => assertDemoAuthAllowed({ NODE_ENV: "production" })).not.toThrow();
  });
  it("demo mode requires the explicit flag and a non-production environment", () => {
    expect(isDemoMode({ DEMO_AUTH: "true", NODE_ENV: "development" })).toBe(true);
    expect(isDemoMode({ DEMO_AUTH: "true", NODE_ENV: "production" })).toBe(false);
    expect(isDemoMode({ NODE_ENV: "development" })).toBe(false);
  });
});
