/**
 * Tenant-scoped query wrapper — the shared MECHANISM (DR-2026-08-31-01;
 * Bridge Matters ADR D13). Extracted from bridge-v3 `packages/db` on the
 * contract-vs-content cut: this package ships the registry contract and
 * the throw-on-unclassified enforcement; each product supplies its own
 * tables via `defineTenantRegistry` at its own call site.
 *
 * Routes do not construct raw queries against tenant-scoped tables — they
 * go through these helpers, which read `ctx.orgId` and pre-apply the
 * filter. For queries whose shape doesn't fit the simple helpers (joins,
 * subqueries, grouped aggregates, raw SQL), use `tenantFilter(ctx, table)`
 * directly as a fragment and compose it into your own `and(...)` clause.
 * This is the principled escape hatch; it does not bypass the
 * classification check.
 *
 * Deliberately OUT of this package: per-tenant-DB routing (bridge-v3's
 * `withTenantDb` / AsyncLocalStorage / catalog — product-specific) and
 * every product's schema and registry content.
 */
import type { SQL } from "drizzle-orm";
import type { PgDatabase, PgTable } from "drizzle-orm/pg-core";
import type { TenantContext } from "./context.js";
import type { TenantRegistry } from "./registry.js";
export declare class UnclassifiedTableError extends Error {
    constructor(tableName: string, registerHint: string);
}
export interface TenantDbConfig {
    registry: TenantRegistry;
    /**
     * Where a developer registers new tables — lands in the
     * UnclassifiedTableError message (e.g. "src/db/tenant-registry.ts").
     */
    registerHint?: string;
}
/**
 * Bind the mechanism to a product's registry. The product typically wraps
 * the result once, partially applying its own `db`:
 *
 *   const tdb = createTenantDb({ registry, registerHint: "src/db/tenant-registry.ts" });
 *   export const { tenantFilter, isTenantScoped, isGlobalTable } = tdb;
 *   export const scopedSelect = (ctx: TenantContext, table: PgTable) =>
 *     tdb.scopedSelect(db, ctx, table);
 */
export declare function createTenantDb(config: TenantDbConfig): {
    tenantFilter: (ctx: TenantContext, table: PgTable) => SQL | undefined;
    scopedSelect: <DB extends PgDatabase<any, any, any>>(db: DB, ctx: TenantContext, table: PgTable) => Omit<import("drizzle-orm/pg-core").PgSelectBase<string, Record<string, import("drizzle-orm/pg-core").PgColumn<import("drizzle-orm").ColumnBaseConfig<import("drizzle-orm").ColumnDataType, string>, {}, {}>>, "single", Record<string, "not-null">, false, "where", {
        [x: string]: unknown;
    }[], {
        [x: string]: import("drizzle-orm/pg-core").PgColumn<import("drizzle-orm").ColumnBaseConfig<import("drizzle-orm").ColumnDataType, string>, {}, {}>;
    }>, "where">;
    isTenantScoped: (table: PgTable) => boolean;
    isGlobalTable: (table: PgTable) => boolean;
    tenantScopeColumnFor: (table: PgTable) => string | undefined;
};
export type TenantDb = ReturnType<typeof createTenantDb>;
//# sourceMappingURL=scoped-query.d.ts.map