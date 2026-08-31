import { describe, expect, it } from "vitest";
import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { defineTenantRegistry, tableNameOf } from "./registry.js";

const widgets = pgTable("widgets", {
  id: uuid("id").primaryKey(),
  orgId: text("org_id").notNull(),
});
const appSettings = pgTable("app_settings", {
  id: uuid("id").primaryKey(),
});

describe("defineTenantRegistry", () => {
  it("builds a registry from arrays", () => {
    const reg = defineTenantRegistry({
      tenantScoped: [[widgets, "orgId"]],
      global: [appSettings],
    });
    expect(reg.tenantScoped.get(widgets)).toBe("orgId");
    expect(reg.global.has(appSettings)).toBe(true);
  });

  it("defaults global to empty", () => {
    const reg = defineTenantRegistry({ tenantScoped: [[widgets, "orgId"]] });
    expect(reg.global.size).toBe(0);
  });

  it("throws on a duplicate tenantScoped registration", () => {
    expect(() =>
      defineTenantRegistry({
        tenantScoped: [
          [widgets, "orgId"],
          [widgets, "orgId"],
        ],
      }),
    ).toThrow(/registered twice/);
  });

  it("throws when a table is both tenant-scoped and global", () => {
    expect(() =>
      defineTenantRegistry({
        tenantScoped: [[widgets, "orgId"]],
        global: [widgets],
      }),
    ).toThrow(/BOTH tenant-scoped and global/);
  });
});

describe("tableNameOf", () => {
  it("returns the SQL table name", () => {
    expect(tableNameOf(widgets)).toBe("widgets");
    expect(tableNameOf(appSettings)).toBe("app_settings");
  });
});
