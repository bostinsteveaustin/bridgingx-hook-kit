/**
 * Verifier tests: round-trip, audience binding (RFC 8707 posture), key/tag
 * separation (a token signed under one derivation tag must not verify under
 * another — the property that keeps Cortx's legacy tag and the platform tag
 * from ever accepting each other's tokens), expiry, and hash stability.
 */
import { describe, expect, it } from "vitest";

import { hs256Verifier, signMcpAccessToken, deriveMcpSigningKey, PLATFORM_MCP_TOKEN_TAG } from "./jwt.js";
import { hashArgs } from "./audit.js";
import { chainSources, oauthSource, resolveCallerContext } from "./context.js";

const SECRET = "test-secret-please-rotate";
const TAG = PLATFORM_MCP_TOKEN_TAG;
const AUD = "https://bridge.example/api/mcp";

const CLAIMS = {
  sub: "user-9",
  client_id: "client-1",
  scopes: ["contracts:read"],
  org_id: "org_test",
  aud: AUD,
};

describe("hs256 verifier", () => {
  it("round-trips a signed token with matching audience", async () => {
    const token = await signMcpAccessToken(CLAIMS, { secret: SECRET, tag: TAG });
    const verifier = hs256Verifier({ secret: SECRET, tag: TAG });
    const claims = await verifier.verify(token, [AUD]);
    expect(claims).toMatchObject({ sub: "user-9", org_id: "org_test", scopes: ["contracts:read"] });
  });

  it("REJECTS a token minted for a different audience (confused-deputy defence)", async () => {
    const token = await signMcpAccessToken({ ...CLAIMS, aud: "https://other.example/api/mcp" }, { secret: SECRET, tag: TAG });
    const verifier = hs256Verifier({ secret: SECRET, tag: TAG });
    expect(await verifier.verify(token, [AUD])).toBeNull();
  });

  it("REJECTS a token signed under a different derivation TAG, same secret", async () => {
    const token = await signMcpAccessToken(CLAIMS, { secret: SECRET, tag: "cortx-oauth-access-token" });
    const verifier = hs256Verifier({ secret: SECRET, tag: TAG });
    expect(await verifier.verify(token, [AUD])).toBeNull();
  });

  it("REJECTS a token signed with a different secret", async () => {
    const token = await signMcpAccessToken(CLAIMS, { secret: "other-secret", tag: TAG });
    const verifier = hs256Verifier({ secret: SECRET, tag: TAG });
    expect(await verifier.verify(token, [AUD])).toBeNull();
  });

  it("REJECTS an expired token", async () => {
    const token = await signMcpAccessToken(CLAIMS, { secret: SECRET, tag: TAG, expiresInSeconds: -10 });
    const verifier = hs256Verifier({ secret: SECRET, tag: TAG });
    expect(await verifier.verify(token, [AUD])).toBeNull();
  });

  it("verification with no audiences THROWS — audience binding is mandatory", async () => {
    const verifier = hs256Verifier({ secret: SECRET, tag: TAG });
    await expect(verifier.verify("whatever", [])).rejects.toThrow(/audience/);
  });

  it("empty secret refuses to derive a key", () => {
    expect(() => deriveMcpSigningKey("", TAG)).toThrow(/empty/);
  });
});

describe("credential chain + context resolution", () => {
  it("chains sources, first recogniser wins, unknown bearer resolves null", async () => {
    const verifier = hs256Verifier({ secret: SECRET, tag: TAG });
    const oauth = oauthSource(verifier, [AUD], (s) => (s.includes("contracts:read") ? ["read"] : []));
    const legacy = async (bearer: string) =>
      bearer === "prod-key"
        ? { token: bearer, clientId: "legacy-user", scopes: ["read"], extra: { userId: "legacy-user", orgId: "org_legacy", via: "api-key" } }
        : null;
    const chain = chainSources(legacy, oauth);

    const viaLegacy = await chain("prod-key");
    expect(resolveCallerContext(viaLegacy)).toMatchObject({ userId: "legacy-user", via: "api-key" });

    const token = await signMcpAccessToken(CLAIMS, { secret: SECRET, tag: TAG });
    const viaOauth = await chain(token);
    expect(resolveCallerContext(viaOauth)).toMatchObject({ userId: "user-9", orgId: "org_test", via: "oauth", scopes: ["read"] });

    expect(await chain("garbage")).toBeNull();
    expect(resolveCallerContext(null)).toBeNull();
  });
});

describe("argsHash", () => {
  it("is stable across key order and hex-shaped", () => {
    const a = hashArgs({ x: 1, y: [2, 3], z: { b: 1, a: 2 } });
    const b = hashArgs({ z: { a: 2, b: 1 }, y: [2, 3], x: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
  it("array order is meaning — different order, different hash", () => {
    expect(hashArgs({ y: [2, 3] })).not.toBe(hashArgs({ y: [3, 2] }));
  });
});
