/**
 * Caller → tenant resolution. FAIL-CLOSED, NO FALLBACK (Phase 0 order): a
 * request that cannot be resolved to a {userId, orgId} pair resolves to null,
 * and the sequencer denies at the identity gate. The kit returns a context
 * object; the PRODUCT passes it into its own tenant routing (Bridge:
 * withTenantDb) — the kit itself never touches a database.
 *
 * Verification is a CHAIN of sources so products keep their legacy lanes
 * without the kit knowing about them: Cortx chains its `crtx_` API-key lookup
 * in front of the OAuth verifier; Bridge supplies the OAuth verifier alone.
 */
import type { McpAuthInfo, McpCallerContext } from "./types.js";
import type { McpTokenVerifier } from "./jwt.js";
/** A credential source: returns AuthInfo for a bearer it recognises, null
 *  otherwise (the chain then tries the next source). */
export type McpCredentialSource = (bearerToken: string) => Promise<McpAuthInfo | null>;
/** OAuth JWT source from a verifier + the resource audiences it accepts. */
export declare function oauthSource(verifier: McpTokenVerifier, audiences: readonly string[], mapScopes: (tokenScopes: readonly string[]) => string[]): McpCredentialSource;
/** Run the chain; first source that recognises the bearer wins. */
export declare function chainSources(...sources: McpCredentialSource[]): McpCredentialSource;
/**
 * AuthInfo → caller context. Null unless BOTH userId and orgId are present —
 * partial identity is no identity (fail-closed).
 */
export declare function resolveCallerContext(authInfo: McpAuthInfo | undefined | null): McpCallerContext | null;
//# sourceMappingURL=context.d.ts.map