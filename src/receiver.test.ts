import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyIncoming, handleSignedHook, type HeadersLike } from "./receiver.js";
import {
  provisionRequestSchema,
  statusResponseSchema,
  suspendRequestSchema,
  ack,
  nack,
} from "./schemas.js";

const SECRET = "s";
const now = () => Math.floor(Date.now() / 1000).toString();

/** Web-Headers-like (case-insensitive) with a valid signature over `body`. */
function headers(body: string, ts = now(), secret = SECRET): HeadersLike {
  const signature =
    "sha256=" + createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  const map = new Map([
    ["x-hook-signature", signature],
    ["x-hook-timestamp", ts],
  ]);
  return { get: (n) => map.get(n.toLowerCase()) ?? null };
}

describe("verifyIncoming — fail-closed status codes", () => {
  it("503 when the secret is not configured", () => {
    expect(verifyIncoming({ rawBody: "x", headers: headers("x"), env: {} })).toMatchObject({
      ok: false,
      status: 503,
    });
  });
  it("401 when a header is missing", () => {
    const bare: HeadersLike = { get: () => null };
    expect(verifyIncoming({ rawBody: "x", headers: bare, secret: SECRET })).toMatchObject({
      ok: false,
      status: 401,
    });
  });
  it("ok on a valid signature", () => {
    const body = "x";
    expect(verifyIncoming({ rawBody: body, headers: headers(body), secret: SECRET })).toEqual({
      ok: true,
    });
  });
  it("verifies GET /status over an empty body", () => {
    expect(verifyIncoming({ rawBody: "", headers: headers(""), secret: SECRET })).toEqual({
      ok: true,
    });
  });
});

describe("handleSignedHook — verify → parse → validate, in order", () => {
  const valid = JSON.stringify({
    tenant: { workosOrgId: "org_1", slug: "acme", name: "Acme" },
    entitlements: ["cortx", "bridge_ci"],
  });

  it("returns typed data on a valid signed payload", () => {
    const r = handleSignedHook({
      rawBody: valid,
      headers: headers(valid),
      secret: SECRET,
      schema: provisionRequestSchema,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.entitlements).toEqual(["cortx", "bridge_ci"]);
  });

  it("401 on a bad signature — BEFORE parsing (no side effects reachable)", () => {
    const r = handleSignedHook({
      rawBody: valid,
      headers: headers(valid, now(), "wrong-secret"),
      secret: SECRET,
      schema: provisionRequestSchema,
    });
    expect(r).toMatchObject({ ok: false, status: 401 });
  });

  it("400 on invalid JSON", () => {
    const body = "{not json";
    const r = handleSignedHook({
      rawBody: body,
      headers: headers(body),
      secret: SECRET,
      schema: provisionRequestSchema,
    });
    expect(r).toMatchObject({ ok: false, status: 400 });
  });

  it("400 on a schema violation (missing required fields)", () => {
    const body = JSON.stringify({ tenant: { workosOrgId: "org_1" } });
    const r = handleSignedHook({
      rawBody: body,
      headers: headers(body),
      secret: SECRET,
      schema: provisionRequestSchema,
    });
    expect(r).toMatchObject({ ok: false, status: 400 });
    if (!r.ok) expect(r.error).toMatch(/validation failed/i);
  });
});

describe("schemas — status + ack helpers", () => {
  it("status accepts the normalised states incl. suspended", () => {
    for (const state of ["pending", "provisioned", "suspended", "deprovisioned", "error"]) {
      expect(statusResponseSchema.safeParse({ state }).success).toBe(true);
    }
    expect(statusResponseSchema.safeParse({ state: "frozen" }).success).toBe(false);
  });
  it("ack / nack build the structured shape", () => {
    expect(ack("provisioned")).toEqual({ ok: true, state: "provisioned" });
    expect(nack("boom")).toEqual({ ok: false, state: "error", detail: "boom" });
  });
  it("suspend requires a scope", () => {
    expect(
      suspendRequestSchema.safeParse({ tenant: { workosOrgId: "o" }, scope: "tenant" }).success,
    ).toBe(true);
    expect(
      suspendRequestSchema.safeParse({ tenant: { workosOrgId: "o" }, scope: "nope" }).success,
    ).toBe(false);
  });
});
