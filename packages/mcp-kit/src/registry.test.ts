/**
 * Registry + HTTP-edge tests: the grain is structurally unavoidable, and the
 * 401 wrapper / rate-limit key behave as the live Cortx server does.
 */
import { describe, expect, it } from "vitest";

import { assertToolDefinitions, composeDescription, type McpToolDefinition } from "./registry.js";
import { jsonResult } from "./errors.js";
import { applyRateLimit, rateLimitKeyFromAuthHeader, withResourceMetadata } from "./http.js";

const DEF: McpToolDefinition = {
  name: "bridge_list_rotors",
  title: "List Deal Rotors",
  description: "List the Deal Rotors the caller may see",
  grain: "rotor-grain: a caller sees all fields of a visible rotor, or nothing",
  inputSchema: {},
  handler: () => jsonResult({}),
};

describe("tool registry", () => {
  it("composed description always ends with the exposure grain", () => {
    const d = composeDescription(DEF);
    expect(d).toBe(
      "List the Deal Rotors the caller may see. Exposure: rotor-grain: a caller sees all fields of a visible rotor, or nothing",
    );
  });

  it("a tool without a grain is unregisterable", () => {
    expect(() => assertToolDefinitions([{ ...DEF, grain: "  " }])).toThrow(/grain/);
  });

  it("duplicate and malformed names are unregisterable", () => {
    expect(() => assertToolDefinitions([DEF, { ...DEF }])).toThrow(/duplicate/);
    expect(() => assertToolDefinitions([{ ...DEF, name: "Bad-Name" }])).toThrow(/lower_snake_case/);
  });
});

describe("http edge", () => {
  it("rate-limit key is a hash, never the credential", () => {
    const key = rateLimitKeyFromAuthHeader("Bearer super-secret-token");
    expect(key).toMatch(/^token:[0-9a-f]{64}$/);
    expect(key).not.toContain("super-secret-token");
    expect(rateLimitKeyFromAuthHeader(null)).toBeNull();
    expect(rateLimitKeyFromAuthHeader("Basic abc")).toBeNull();
  });

  it("null limiter means proceed; a refusing limiter returns 429 + Retry-After", async () => {
    const req = new Request("https://x.example/api/mcp", { headers: { authorization: "Bearer t" } });
    expect(await applyRateLimit(req, null)).toBeNull();
    const refused = await applyRateLimit(req, { check: async () => ({ allowed: false, retryAfterSeconds: 30 }) });
    expect(refused?.status).toBe(429);
    expect(refused?.headers.get("Retry-After")).toBe("30");
  });

  it("401 gains the RFC 9728 WWW-Authenticate header; other statuses untouched", () => {
    const url = "https://x.example/.well-known/oauth-protected-resource";
    const wrapped = withResourceMetadata(new Response("no", { status: 401 }), url);
    expect(wrapped.headers.get("WWW-Authenticate")).toBe(`Bearer resource_metadata="${url}"`);
    const ok = new Response("yes", { status: 200 });
    expect(withResourceMetadata(ok, url)).toBe(ok);
  });
});
