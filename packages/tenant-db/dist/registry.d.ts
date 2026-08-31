import type { PgTable } from "drizzle-orm/pg-core";
/**
 * The registry CONTRACT (DR-2026-08-31-01, contract-vs-content cut): this
 * package ships the shape and the enforcement; each product supplies the
 * data — its own tables, registered at its own call site via
 * `defineTenantRegistry`. No product's table list ships in this package.
 */
export interface TenantRegistry {
    /**
     * table → name of the tenant-scope column PROPERTY on the Drizzle table
     * object (e.g. "orgId" for a column defined as `orgId: uuid("org_id")`).
     */
    readonly tenantScoped: ReadonlyMap<PgTable, string>;
    /**
     * Tables deliberately readable/writable without a tenant filter (e.g.
     * the auth-resolution path that looks up users before a tenant context
     * exists). New tenant-data tables do NOT go here.
     */
    readonly global: ReadonlySet<PgTable>;
}
/**
 * Build a TenantRegistry, failing loud at definition time on the two
 * classification mistakes a competent engineer can make: registering a
 * table twice, and registering a table as both tenant-scoped and global.
 */
export declare function defineTenantRegistry(input: {
    tenantScoped: ReadonlyArray<readonly [PgTable, string]>;
    global?: ReadonlyArray<PgTable>;
}): TenantRegistry;
export declare function tableNameOf(table: PgTable): string;
//# sourceMappingURL=registry.d.ts.map