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
export function tenantContextFromUser(user: {
  id: string;
  orgId: string;
  isAdmin?: boolean;
}): TenantContext {
  return {
    orgId: user.orgId,
    userId: user.id,
    isAdmin: user.isAdmin ?? false,
  };
}

export class MissingTenantContextError extends Error {
  constructor(detail: string) {
    super(`Missing tenant context: ${detail}`);
    this.name = "MissingTenantContextError";
  }
}

export function assertValidContext(ctx: TenantContext): void {
  if (!ctx.orgId || ctx.orgId.length === 0) {
    throw new MissingTenantContextError("orgId is empty");
  }
  if (!ctx.userId || ctx.userId.length === 0) {
    throw new MissingTenantContextError("userId is empty");
  }
}
