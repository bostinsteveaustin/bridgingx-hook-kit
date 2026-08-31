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

import { eq } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { PgDatabase, PgTable } from "drizzle-orm/pg-core";
import { assertValidContext } from "./context.js";
import type { TenantContext } from "./context.js";
import { tableNameOf } from "./registry.js";
import type { TenantRegistry } from "./registry.js";

export class UnclassifiedTableError extends Error {
  constructor(tableName: string, registerHint: string) {
    super(
      `Table "${tableName}" is neither in TENANT_SCOPED_TABLES nor GLOBAL_TABLES. ` +
        `Register it in ${registerHint} before querying.`,
    );
    this.name = "UnclassifiedTableError";
  }
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
export function createTenantDb(config: TenantDbConfig) {
  const { registry } = config;
  const registerHint =
    config.registerHint ?? "your tenant registry (the defineTenantRegistry call site)";

  function isTenantScoped(table: PgTable): boolean {
    return registry.tenantScoped.has(table);
  }

  function isGlobalTable(table: PgTable): boolean {
    return registry.global.has(table);
  }

  function tenantScopeColumnFor(table: PgTable): string | undefined {
    return registry.tenantScoped.get(table);
  }

  /**
   * Returns the SQL fragment that filters `table` to the caller's tenant,
   * or `undefined` when the table is explicitly global. Throws on
   * unclassified tables or invalid contexts.
   */
  function tenantFilter(ctx: TenantContext, table: PgTable): SQL | undefined {
    assertValidContext(ctx);

    if (isTenantScoped(table)) {
      const columnName = tenantScopeColumnFor(table);
      if (!columnName) {
        // Defensive — the Map said yes but didn't give us a column. Bug.
        throw new UnclassifiedTableError(tableNameOf(table), registerHint);
      }
      // Drizzle column access via index — typed as `unknown` at runtime,
      // so cast at the boundary.
      const column = (table as unknown as Record<string, unknown>)[columnName];
      if (!column) {
        throw new Error(
          `tenantFilter: column "${columnName}" not found on table "${tableNameOf(table)}". ` +
            `Check the table definition and its registry entry.`,
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return eq(column as any, ctx.orgId);
    }

    if (isGlobalTable(table)) return undefined;

    throw new UnclassifiedTableError(tableNameOf(table), registerHint);
  }

  /**
   * Select all columns from a tenant-scoped table, filtered to the
   * caller's tenant. For typed projections, joins, or extra WHERE
   * clauses, drop down to `tenantFilter(ctx, table)` + raw Drizzle.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function scopedSelect<DB extends PgDatabase<any, any, any>>(
    db: DB,
    ctx: TenantContext,
    table: PgTable,
  ) {
    const filter = tenantFilter(ctx, table);
    const builder = db.select().from(table);
    return filter ? builder.where(filter) : builder;
  }

  return {
    tenantFilter,
    scopedSelect,
    isTenantScoped,
    isGlobalTable,
    tenantScopeColumnFor,
  };
}

export type TenantDb = ReturnType<typeof createTenantDb>;
