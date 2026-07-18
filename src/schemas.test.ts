import { describe, it, expect } from "vitest";
import {
  provisionRequestSchema,
  tenantConfigSchema,
  TENANT_CONFIG_VERSION,
} from "./schemas.js";

const TENANT = { workosOrgId: "org_1", slug: "acme", name: "Acme" };

describe("tenantConfigSchema (Phase 2, AB-16)", () => {
  it("accepts a full config block and defaults modules to {}", () => {
    const full = tenantConfigSchema.parse({
      version: TENANT_CONFIG_VERSION,
      brand: "Ascot Insurance",
      modules: { approve: false, signing: true },
    });
    expect(full.modules).toEqual({ approve: false, signing: true });

    const bare = tenantConfigSchema.parse({ version: 1 });
    expect(bare.modules).toEqual({}); // opaque map defaults empty
    expect(bare.brand).toBeUndefined();
  });

  it("allows brand to be explicitly null (fall back to tenant name)", () => {
    const c = tenantConfigSchema.parse({ version: 1, brand: null });
    expect(c.brand).toBeNull();
  });

  it("rejects non-boolean module values and non-positive versions", () => {
    expect(
      tenantConfigSchema.safeParse({ version: 1, modules: { approve: "yes" } })
        .success,
    ).toBe(false);
    expect(tenantConfigSchema.safeParse({ version: 0 }).success).toBe(false);
    expect(tenantConfigSchema.safeParse({}).success).toBe(false); // version required
  });
});

describe("provisionRequestSchema — config is optional (backward compatible)", () => {
  it("validates a pre-Phase-2 payload with no config block", () => {
    const r = provisionRequestSchema.parse({
      tenant: TENANT,
      entitlements: ["bridge"],
    });
    expect(r.config).toBeUndefined();
  });

  it("validates a payload carrying the config block", () => {
    const r = provisionRequestSchema.parse({
      tenant: TENANT,
      entitlements: ["bridge"],
      config: { version: 1, brand: "Ascot Insurance", modules: { signing: false } },
    });
    expect(r.config?.modules).toEqual({ signing: false });
  });
});
