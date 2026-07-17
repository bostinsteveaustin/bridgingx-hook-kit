import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Strict HMAC-SHA256 signing + verification for the BX Admin ↔ product boundary.
 *
 * This is the SINGLE, canonical implementation (Receiver Conformance Specification
 * — Cortx ctx e5f4338b, @reference_data). Receivers MUST NOT re-implement it, and
 * MUST NOT widen it: no header aliases, no alternative timestamp encodings, no
 * tolerant/hand-rolled parsing. A widened parser is a widened attack surface
 * (@pitfalls: Tolerant verifier drift).
 *
 *   signature = HMAC-SHA256(secret, `${timestamp}.${body}`)  → sent as sha256=<hex>
 *
 * Transport (spec @reference_data, v1.0.0):
 *   X-Hook-Signature: sha256=<64 hex>   (format-gated before any comparison)
 *   X-Hook-Timestamp: <unix-seconds>    (strict numeric; 300s replay window)
 */

/** Replay window: reject timestamps more than this many seconds from now. */
export const TIMESTAMP_TOLERANCE_SECONDS = 300;

/** Canonical header names — the ONLY accepted names (no aliases). */
export const SIGNATURE_HEADER = "X-Hook-Signature";
export const TIMESTAMP_HEADER = "X-Hook-Timestamp";

/** `sha256=` + exactly 64 hex chars. Anything else fails closed. */
const SIGNATURE_FORMAT = /^sha256=[0-9a-f]{64}$/i;
const NUMERIC = /^\d+$/;

export interface SignHeaders {
  "X-Hook-Signature": string;
  "X-Hook-Timestamp": string;
}

export interface VerifyResult {
  valid: boolean;
  reason?: string;
}

/**
 * Resolve a product's signing secret from the environment. The per-product name
 * is data-driven from the registry key (`PRODUCT_HOOK_SIGNING_SECRET_<KEY>`, e.g.
 * `_CORTX`), falling back to the shared `PRODUCT_HOOK_SIGNING_SECRET`.
 *
 * The shared-secret fallback is DEPRECATED (spec @reference_data) and will be
 * retired once every receiver holds a per-product secret; per-product secrets let
 * each product rotate independently and stop a compromised secret forging calls
 * to another product.
 */
export function resolveSigningSecret(
  productKey?: string,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (productKey) {
    const suffix = productKey.toUpperCase().replace(/[^A-Z0-9]/g, "_");
    const perProduct = env[`PRODUCT_HOOK_SIGNING_SECRET_${suffix}`];
    if (perProduct) return perProduct;
  }
  return env["PRODUCT_HOOK_SIGNING_SECRET"];
}

/**
 * Sign a request body (admin sending side). Returns the two canonical headers.
 * `productKey` selects the per-product secret.
 */
export function signPayload(body: string, productKey?: string): SignHeaders {
  const secret = resolveSigningSecret(productKey);
  if (!secret) {
    throw new Error(
      "PRODUCT_HOOK_SIGNING_SECRET is not set — cannot sign hook calls. Set " +
        "PRODUCT_HOOK_SIGNING_SECRET or a per-product PRODUCT_HOOK_SIGNING_SECRET_<KEY>.",
    );
  }
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return {
    "X-Hook-Signature": `sha256=${signature}`,
    "X-Hook-Timestamp": timestamp,
  };
}

/**
 * Verify a signed request (receiver side). Pure — takes the already-resolved
 * secret. Fails closed on any deviation. Order: strict-numeric timestamp →
 * replay window → signature format gate → constant-time HMAC compare.
 */
export function verifyPayload(
  body: string,
  signature: string,
  timestamp: string,
  secret: string,
): VerifyResult {
  if (!NUMERIC.test(timestamp)) {
    return { valid: false, reason: "Invalid timestamp" };
  }
  const ts = Number.parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TIMESTAMP_TOLERANCE_SECONDS) {
    return { valid: false, reason: "Timestamp outside replay window" };
  }

  // Format gate BEFORE any crypto work — fail closed on malformed input.
  if (!SIGNATURE_FORMAT.test(signature)) {
    return { valid: false, reason: "Signature mismatch" };
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  const provided = signature.slice("sha256=".length);

  // Length pre-check (timingSafeEqual throws on unequal lengths; length is not
  // secret), then a genuinely constant-time compare of equal-length buffers.
  if (expected.length !== provided.length) {
    return { valid: false, reason: "Signature mismatch" };
  }
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: "Signature mismatch" };
  }
  return { valid: true };
}
