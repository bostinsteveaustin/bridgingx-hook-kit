import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  verifyPayload,
  signPayload,
  resolveSigningSecret,
  TIMESTAMP_TOLERANCE_SECONDS,
} from "./signing";

const SECRET = "test-secret";
const now = () => Math.floor(Date.now() / 1000).toString();
const sig = (body: string, ts: string, secret = SECRET) =>
  "sha256=" + createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");

describe("verifyPayload — strict, fail-closed", () => {
  it("accepts a valid signature within the replay window", () => {
    const ts = now();
    const body = '{"a":1}';
    expect(verifyPayload(body, sig(body, ts), ts, SECRET)).toEqual({ valid: true });
  });

  it("rejects a tampered body", () => {
    const ts = now();
    expect(verifyPayload('{"a":2}', sig('{"a":1}', ts), ts, SECRET).valid).toBe(false);
  });

  it("rejects the wrong secret", () => {
    const ts = now();
    expect(verifyPayload("x", sig("x", ts, "other"), ts, SECRET).valid).toBe(false);
  });

  it("rejects a stale timestamp (replay window)", () => {
    const ts = String(Math.floor(Date.now() / 1000) - TIMESTAMP_TOLERANCE_SECONDS - 5);
    const r = verifyPayload("x", sig("x", ts), ts, SECRET);
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/replay window/i);
  });

  it("rejects a non-numeric timestamp before any crypto", () => {
    expect(verifyPayload("x", sig("x", "123"), "12a3", SECRET).valid).toBe(false);
  });

  it("rejects malformed signature formats (no aliases, no coercion)", () => {
    const ts = now();
    expect(verifyPayload("x", "sha256=nothex", ts, SECRET).valid).toBe(false);
    expect(verifyPayload("x", "deadbeef", ts, SECRET).valid).toBe(false);
    expect(verifyPayload("x", "t=1,v1=abc", ts, SECRET).valid).toBe(false); // Stripe-style rejected
  });
});

describe("resolveSigningSecret — per-product with deprecated shared fallback", () => {
  it("prefers the per-product secret", () => {
    expect(
      resolveSigningSecret("cortx", {
        PRODUCT_HOOK_SIGNING_SECRET_CORTX: "per",
        PRODUCT_HOOK_SIGNING_SECRET: "shared",
      }),
    ).toBe("per");
  });
  it("falls back to the shared secret", () => {
    expect(resolveSigningSecret("cortx", { PRODUCT_HOOK_SIGNING_SECRET: "shared" })).toBe("shared");
  });
  it("normalises the key suffix (hyphens → underscores, upper-case)", () => {
    expect(resolveSigningSecret("bridge-ci", { PRODUCT_HOOK_SIGNING_SECRET_BRIDGE_CI: "x" })).toBe("x");
  });
  it("returns undefined when nothing is set", () => {
    expect(resolveSigningSecret("cortx", {})).toBeUndefined();
  });
});

describe("signPayload → verifyPayload round-trip", () => {
  it("a signed body verifies with the same secret", () => {
    const prev = process.env.PRODUCT_HOOK_SIGNING_SECRET;
    process.env.PRODUCT_HOOK_SIGNING_SECRET = SECRET;
    try {
      const body = '{"hello":"world"}';
      const h = signPayload(body);
      expect(
        verifyPayload(body, h["X-Hook-Signature"], h["X-Hook-Timestamp"], SECRET),
      ).toEqual({ valid: true });
    } finally {
      if (prev === undefined) delete process.env.PRODUCT_HOOK_SIGNING_SECRET;
      else process.env.PRODUCT_HOOK_SIGNING_SECRET = prev;
    }
  });

  it("signPayload throws when no secret is configured", () => {
    const prev = process.env.PRODUCT_HOOK_SIGNING_SECRET;
    delete process.env.PRODUCT_HOOK_SIGNING_SECRET;
    try {
      expect(() => signPayload("x")).toThrow(/not set/i);
    } finally {
      if (prev !== undefined) process.env.PRODUCT_HOOK_SIGNING_SECRET = prev;
    }
  });
});
