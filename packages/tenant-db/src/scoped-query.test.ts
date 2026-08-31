import { describe, expect, it } from "vitest";
import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pg-proxy";
import { MissingTenantContextError, type TenantContext } from "./context.js";
import { defineTenantRegistry } from "./registry.js";
import { createTenantDb, UnclassifiedTableError } from "./scoped-query.js";

const widgets = pgTable("widgets", {
  id: uuid("id").primaryKey(),
  orgId: text("org_id").notNull(),
  name: text("name"),
});
const appSettings = pgTable("app_settings", {
  id: uuid("id").primaryKey(),
});
const strays = pgTable("strays", {
  id: uuid("id").primaryKey(),
});

const registry = defineTenantRegistry({
  tenantScoped: [[widgets, "orgId"]],
  global: [appSettings],
});
const tdb = createTenantDb({ registry, registerHint: "src/db/tenant-registry.ts" });
const ctx: TenantContext = { orgId: "org-1", userId: "user-1", isAdmin: false };

// A PgDatabase with no real connection — good enough to render SQL.
const db = drizzle(async () => ({ rows: [] }));

describe("tenantFilter", () => {
  it("returns a filter fragment for a tenant-scoped table", () => {
    expect(tdb.tenantFilter(ctx, widgets)).toBeDefined();
  });

  it("returns undefined for an explicitly global table", () => {
    expect(tdb.tenantFilter(ctx, appSettings)).toBeUndefined();
  });

  it("throws UnclassifiedTableError for an unregistered table, naming the register hint", () => {
    expect(() => tdb.tenantFilter(ctx, strays)).toThrow(UnclassifiedTableError);
    expect(() => tdb.tenantFilter(ctx, strays)).toThrow(/src\/db\/tenant-registry\.ts/);
  });

  it("throws MissingTenantContextError on an empty orgId", () => {
    expect(() => tdb.tenantFilter({ ...ctx, orgId: "" }, widgets)).toThrow(
      MissingTenantContextError,
    );
  });

  it("throws MissingTenantContextError on an empty userId", () => {
    expect(() => tdb.tenantFilter({ ...ctx, userId: "" }, widgets)).toThrow(
      MissingTenantContextError,
    );
  });

  it("fails loud when the registered column does not exist on the table", () => {
    const broken = createTenantDb({
      registry: defineTenantRegistry({ tenantScoped: [[widgets, "nope"]] }),
    });
    expect(() => broken.tenantFilter(ctx, widgets)).toThrow(/column "nope" not found/);
  });
});

describe("scopedSelect", () => {
  it("applies the org filter to a tenant-scoped table", () => {
    const { sql, params } = tdb.scopedSelect(db, ctx, widgets).toSQL();
    expect(sql).toMatch(/where/i);
    expect(sql).toMatch(/"org_id" = \$1/);
    expect(params).toEqual(["org-1"]);
  });

  it("applies no filter to a global table", () => {
    const { sql, params } = tdb.scopedSelect(db, ctx, appSettings).toSQL();
    expect(sql).not.toMatch(/where/i);
    expect(params).toEqual([]);
  });

  it("refuses an unclassified table outright", () => {
    expect(() => tdb.scopedSelect(db, ctx, strays)).toThrow(UnclassifiedTableError);
  });
});

describe("classification predicates", () => {
  it("answer from the supplied registry", () => {
    expect(tdb.isTenantScoped(widgets)).toBe(true);
    expect(tdb.isTenantScoped(appSettings)).toBe(false);
    expect(tdb.isGlobalTable(appSettings)).toBe(true);
    expect(tdb.tenantScopeColumnFor(widgets)).toBe("orgId");
    expect(tdb.tenantScopeColumnFor(strays)).toBeUndefined();
  });
});
