import { getTableName } from "drizzle-orm";
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
export function defineTenantRegistry(input: {
  tenantScoped: ReadonlyArray<readonly [PgTable, string]>;
  global?: ReadonlyArray<PgTable>;
}): TenantRegistry {
  const seen = new Set<PgTable>();
  for (const [table] of input.tenantScoped) {
    if (seen.has(table)) {
      throw new Error(
        `defineTenantRegistry: table "${getTableName(table)}" is registered twice in tenantScoped — remove the duplicate.`,
      );
    }
    seen.add(table);
  }

  const tenantScoped = new Map<PgTable, string>(input.tenantScoped);
  const global = new Set<PgTable>(input.global ?? []);

  for (const table of tenantScoped.keys()) {
    if (global.has(table)) {
      throw new Error(
        `defineTenantRegistry: table "${getTableName(table)}" is registered as BOTH tenant-scoped and global — pick one.`,
      );
    }
  }

  return { tenantScoped, global };
}

export function tableNameOf(table: PgTable): string {
  return getTableName(table);
}
