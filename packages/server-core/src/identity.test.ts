import { describe, expect, it } from "vitest";
import type { FastifyRequest } from "fastify";
import { assertSameOrigin } from "./identity.js";

function req(headers: Record<string, string>): FastifyRequest {
  return { headers } as unknown as FastifyRequest;
}

describe("assertSameOrigin", () => {
  it("allows missing Origin (non-browser clients)", () => {
    expect(() => assertSameOrigin(req({ host: "localhost:4000" }), undefined)).not.toThrow();
  });
  it("allows the API host and the configured web origin", () => {
    expect(() => assertSameOrigin(req({ host: "localhost:4000", origin: "http://localhost:4000" }), undefined)).not.toThrow();
    expect(() => assertSameOrigin(req({ host: "localhost:4000", origin: "http://localhost:5173" }), "http://localhost:5173")).not.toThrow();
  });
  it("rejects a foreign origin", () => {
    expect(() => assertSameOrigin(req({ host: "localhost:4000", origin: "https://evil.example" }), "http://localhost:5173")).toThrowError(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
    expect(() => assertSameOrigin(req({ host: "localhost:4000", origin: "not a url" }), undefined)).toThrowError(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
  });
});
