/** OAuth JWT source from a verifier + the resource audiences it accepts. */
export function oauthSource(verifier, audiences, mapScopes) {
    return async (bearerToken) => {
        const claims = await verifier.verify(bearerToken, audiences);
        if (!claims)
            return null;
        return {
            token: bearerToken,
            clientId: claims.sub,
            scopes: mapScopes(claims.scopes),
            extra: { userId: claims.sub, orgId: claims.org_id, via: "oauth" },
        };
    };
}
/** Run the chain; first source that recognises the bearer wins. */
export function chainSources(...sources) {
    return async (bearerToken) => {
        for (const source of sources) {
            const info = await source(bearerToken);
            if (info)
                return info;
        }
        return null;
    };
}
/**
 * AuthInfo → caller context. Null unless BOTH userId and orgId are present —
 * partial identity is no identity (fail-closed).
 */
export function resolveCallerContext(authInfo) {
    const userId = authInfo?.extra?.["userId"];
    const orgId = authInfo?.extra?.["orgId"];
    if (typeof userId !== "string" || userId.length === 0)
        return null;
    if (typeof orgId !== "string" || orgId.length === 0)
        return null;
    const via = authInfo?.extra?.["via"] === "api-key" ? "api-key" : "oauth";
    return { userId, orgId, scopes: authInfo?.scopes ?? [], via };
}
//# sourceMappingURL=context.js.map