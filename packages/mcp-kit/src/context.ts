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
export function oauthSource(
  verifier: McpTokenVerifier,
  audiences: readonly string[],
  mapScopes: (tokenScopes: readonly string[]) => string[],
): McpCredentialSource {
  return async (bearerToken) => {
    const claims = await verifier.verify(bearerToken, audiences);
    if (!claims) return null;
    return {
      token: bearerToken,
      clientId: claims.sub,
      scopes: mapScopes(claims.scopes),
      extra: { userId: claims.sub, orgId: claims.org_id, via: "oauth" },
    };
  };
}

/** Run the chain; first source that recognises the bearer wins. */
export function chainSources(...sources: McpCredentialSource[]): McpCredentialSource {
  return async (bearerToken) => {
    for (const source of sources) {
      const info = await source(bearerToken);
      if (info) return info;
    }
    return null;
  };
}

/**
 * AuthInfo → caller context. Null unless BOTH userId and orgId are present —
 * partial identity is no identity (fail-closed).
 */
export function resolveCallerContext(authInfo: McpAuthInfo | undefined | null): McpCallerContext | null {
  const userId = authInfo?.extra?.["userId"];
  const orgId = authInfo?.extra?.["orgId"];
  if (typeof userId !== "string" || userId.length === 0) return null;
  if (typeof orgId !== "string" || orgId.length === 0) return null;
  const via = authInfo?.extra?.["via"] === "api-key" ? "api-key" : "oauth";
  return { userId, orgId, scopes: authInfo?.scopes ?? [], via };
}
