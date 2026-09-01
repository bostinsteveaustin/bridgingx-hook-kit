/** The kit's own derivation tag for the cross-product platform secret. */
export declare const PLATFORM_MCP_TOKEN_TAG = "bridgingx-mcp-access-token";
export interface McpAccessTokenClaims {
    /** Product-local user id. */
    sub: string;
    client_id: string;
    scopes: string[];
    org_id: string;
    aud: string;
}
export interface McpTokenVerifier {
    verify(token: string, audiences: readonly string[]): Promise<McpAccessTokenClaims | null>;
}
/** Domain-tagged HS256 key derivation — one implementation for sign + verify. */
export declare function deriveMcpSigningKey(secret: string, tag: string): Uint8Array;
/** Sign an MCP access token (the authorization server side). */
export declare function signMcpAccessToken(claims: McpAccessTokenClaims, opts: {
    secret: string;
    tag: string;
    expiresInSeconds?: number;
}): Promise<string>;
/**
 * HS256 verifier factory. Audience binding is MANDATORY (RFC 8707 posture,
 * lifted from the live Cortx server): a token minted for another resource
 * server verifies cryptographically and is still rejected — the
 * confused-deputy defence.
 */
export declare function hs256Verifier(opts: {
    secret: string;
    tag: string;
}): McpTokenVerifier;
//# sourceMappingURL=jwt.d.ts.map