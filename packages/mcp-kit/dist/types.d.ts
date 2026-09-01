/**
 * Shared MCP types — deliberately STRUCTURAL, with no import from the MCP SDK
 * or any transport package: the kit sequences and shapes, the consuming product
 * owns its transport (Cortx uses `mcp-handler`; Bridge will too). Keeping the
 * kit dependency-light is what lets both consume it from a git tag without
 * dragging a transport version pin across products.
 */
/** The resolved, verified caller of an MCP request. The ONLY way tools learn
 *  who is calling — products never re-parse the bearer themselves. */
export interface McpCallerContext {
    /** Product-local user id (Cortx users.id / Bridge users.id). */
    userId: string;
    /** WorkOS org id or product-local org id — whatever the product's tenant
     *  routing keys on. The kit treats it as opaque; fail-closed when absent. */
    orgId: string;
    /** Coarse scopes carried by the credential (e.g. ["read"] / ["read","write"]). */
    scopes: readonly string[];
    /** How the caller authenticated — products may gate tools on this. */
    via: "oauth" | "api-key";
}
/** Minimal structural view of the SDK's AuthInfo — what verifiers produce and
 *  the sequencer consumes. Matches `withMcpAuth`'s expectations shape-for-shape. */
export interface McpAuthInfo {
    token: string;
    clientId: string;
    scopes: string[];
    extra?: Record<string, unknown>;
}
/** MCP tool result, structurally (content blocks + optional isError). */
export interface McpToolResult {
    content: Array<{
        type: "text";
        text: string;
    }>;
    isError?: boolean;
    [key: string]: unknown;
}
/** Injected rate limiter (Phase 0: Cortx backs this with Upstash; Bridge may
 *  start without one). The kit never assumes a store. */
export interface McpRateLimiter {
    check(key: string): Promise<{
        allowed: boolean;
        retryAfterSeconds?: number;
    }>;
}
//# sourceMappingURL=types.d.ts.map