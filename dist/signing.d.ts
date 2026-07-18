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
export declare const TIMESTAMP_TOLERANCE_SECONDS = 300;
/** Canonical header names — the ONLY accepted names (no aliases). */
export declare const SIGNATURE_HEADER = "X-Hook-Signature";
export declare const TIMESTAMP_HEADER = "X-Hook-Timestamp";
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
export declare function resolveSigningSecret(productKey?: string, env?: NodeJS.ProcessEnv): string | undefined;
/**
 * Sign a request body (admin sending side). Returns the two canonical headers.
 * `productKey` selects the per-product secret.
 */
export declare function signPayload(body: string, productKey?: string): SignHeaders;
/**
 * Verify a signed request (receiver side). Pure — takes the already-resolved
 * secret. Fails closed on any deviation. Order: strict-numeric timestamp →
 * replay window → signature format gate → constant-time HMAC compare.
 */
export declare function verifyPayload(body: string, signature: string, timestamp: string, secret: string): VerifyResult;
//# sourceMappingURL=signing.d.ts.map