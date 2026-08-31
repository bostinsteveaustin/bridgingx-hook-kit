/**
 * Per-request tenant context. Constructed at the route boundary from the
 * authenticated user and passed to every wrapper helper. Tenant scope
 * comes from the identity token's org claim — never a URL parameter,
 * never a user row (estate token-as-authority rule).
 */
export interface TenantContext {
    readonly orgId: string;
    readonly userId: string;
    readonly isAdmin: boolean;
}
/**
 * Build a TenantContext from an authenticated user. Every route that
 * touches tenant-scoped data starts with this.
 */
export declare function tenantContextFromUser(user: {
    id: string;
    orgId: string;
    isAdmin?: boolean;
}): TenantContext;
export declare class MissingTenantContextError extends Error {
    constructor(detail: string);
}
export declare function assertValidContext(ctx: TenantContext): void;
//# sourceMappingURL=context.d.ts.map