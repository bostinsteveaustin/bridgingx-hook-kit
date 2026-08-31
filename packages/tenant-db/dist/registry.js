import { getTableName } from "drizzle-orm";
/**
 * Build a TenantRegistry, failing loud at definition time on the two
 * classification mistakes a competent engineer can make: registering a
 * table twice, and registering a table as both tenant-scoped and global.
 */
export function defineTenantRegistry(input) {
    const seen = new Set();
    for (const [table] of input.tenantScoped) {
        if (seen.has(table)) {
            throw new Error(`defineTenantRegistry: table "${getTableName(table)}" is registered twice in tenantScoped — remove the duplicate.`);
        }
        seen.add(table);
    }
    const tenantScoped = new Map(input.tenantScoped);
    const global = new Set(input.global ?? []);
    for (const table of tenantScoped.keys()) {
        if (global.has(table)) {
            throw new Error(`defineTenantRegistry: table "${getTableName(table)}" is registered as BOTH tenant-scoped and global — pick one.`);
        }
    }
    return { tenantScoped, global };
}
export function tableNameOf(table) {
    return getTableName(table);
}
//# sourceMappingURL=registry.js.map