/**
 * Build a TenantContext from an authenticated user. Every route that
 * touches tenant-scoped data starts with this.
 */
export function tenantContextFromUser(user) {
    return {
        orgId: user.orgId,
        userId: user.id,
        isAdmin: user.isAdmin ?? false,
    };
}
export class MissingTenantContextError extends Error {
    constructor(detail) {
        super(`Missing tenant context: ${detail}`);
        this.name = "MissingTenantContextError";
    }
}
export function assertValidContext(ctx) {
    if (!ctx.orgId || ctx.orgId.length === 0) {
        throw new MissingTenantContextError("orgId is empty");
    }
    if (!ctx.userId || ctx.userId.length === 0) {
        throw new MissingTenantContextError("userId is empty");
    }
}
//# sourceMappingURL=context.js.map