/**
 * MCP access-token signing + verification — PLUGGABLE by construction (hub
 * ruling on the §5 trust model): the consumer holds a `McpTokenVerifier`, and
 * swapping HS256 for RS256/JWKS later is a new factory here, with NO
 * consumer-side change. RS256/JWKS is the named future state; trigger = any
 * MCP write tool shipping, or a third product consuming the kit.
 *
 * HS256 key derivation is domain-tagged (HMAC(secret, tag)) so one secret can
 * never be confused across uses. Two deployment shapes, both expressible:
 *   - Cortx TODAY (behaviour-preserving refactor): its own AUTH_SECRET + its
 *     historical "cortx-oauth-access-token" tag — existing tokens keep
 *     verifying bit-for-bit.
 *   - The PLATFORM secret (hub-recommended (a)): PLATFORM_MCP_JWT_SECRET with
 *     the kit's own tag below, shared across products under an AB-18-style
 *     rotation ceremony. NOT Cortx's AUTH_SECRET — a product's session secret
 *     must never become a cross-product trust root.
 */
import { createHmac } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
/** The kit's own derivation tag for the cross-product platform secret. */
export const PLATFORM_MCP_TOKEN_TAG = "bridgingx-mcp-access-token";
/** Domain-tagged HS256 key derivation — one implementation for sign + verify. */
export function deriveMcpSigningKey(secret, tag) {
    if (!secret)
        throw new Error("[mcp-kit] signing secret is empty — refusing to derive a key.");
    return new Uint8Array(createHmac("sha256", secret).update(tag).digest());
}
/** Sign an MCP access token (the authorization server side). */
export async function signMcpAccessToken(claims, opts) {
    const key = deriveMcpSigningKey(opts.secret, opts.tag);
    return new SignJWT({
        client_id: claims.client_id,
        scopes: claims.scopes,
        org_id: claims.org_id,
    })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setSubject(claims.sub)
        .setAudience(claims.aud)
        .setJti(crypto.randomUUID())
        .setIssuedAt()
        .setExpirationTime(`${opts.expiresInSeconds ?? 900}s`)
        .sign(key);
}
/**
 * HS256 verifier factory. Audience binding is MANDATORY (RFC 8707 posture,
 * lifted from the live Cortx server): a token minted for another resource
 * server verifies cryptographically and is still rejected — the
 * confused-deputy defence.
 */
export function hs256Verifier(opts) {
    const key = deriveMcpSigningKey(opts.secret, opts.tag);
    return {
        async verify(token, audiences) {
            if (audiences.length === 0) {
                throw new Error("[mcp-kit] verify called with no audiences — audience binding is mandatory.");
            }
            try {
                const { payload } = await jwtVerify(token, key, { audience: [...audiences] });
                if (typeof payload.sub !== "string" ||
                    typeof payload.org_id !== "string" ||
                    !Array.isArray(payload.scopes)) {
                    return null; // structurally not one of ours — fail closed
                }
                return {
                    sub: payload.sub,
                    client_id: typeof payload.client_id === "string" ? payload.client_id : payload.sub,
                    scopes: payload.scopes.filter((s) => typeof s === "string"),
                    org_id: payload.org_id,
                    aud: Array.isArray(payload.aud) ? (payload.aud[0] ?? "") : (payload.aud ?? ""),
                };
            }
            catch {
                return null; // expired, bad signature, wrong audience — all identical outside
            }
        },
    };
}
//# sourceMappingURL=jwt.js.map