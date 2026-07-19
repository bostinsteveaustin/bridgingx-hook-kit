import { describe, it, expect } from "vitest";
import {
  provisionRequestSchema,
  tenantConfigSchema,
  TENANT_CONFIG_VERSION,
  tenantLimitsSchema,
  TENANT_LIMITS_VERSION,
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

describe("tenantLimitsSchema (Phase 2, AB-25 / DR-2026-07-18-10)", () => {
  it("accepts a full limits block: plan + seat caps + per-product quotas", () => {
    const l = tenantLimitsSchema.parse({
      version: TENANT_LIMITS_VERSION,
      plan: "pro",
      seats: { total: 10, perProduct: { bridge: 10, cortx: 5 } },
      quotas: { cortx: { contexts: 50, spaces: 10 } },
    });
    expect(l.seats?.total).toBe(10);
    expect(l.seats?.perProduct).toEqual({ bridge: 10, cortx: 5 });
    expect(l.quotas?.cortx).toEqual({ contexts: 50, spaces: 10 });
  });

  it("accepts a bare versioned block (no plan = uncapped)", () => {
    const l = tenantLimitsSchema.parse({ version: 1, plan: null });
    expect(l.plan).toBeNull();
    expect(l.seats).toBeUndefined();
    expect(l.quotas).toBeUndefined();
  });

  it("junk-proofs caps: rejects zero, negative, and non-integer seat caps", () => {
    expect(
      tenantLimitsSchema.safeParse({ version: 1, seats: { total: 0 } }).success,
    ).toBe(false);
    expect(
      tenantLimitsSchema.safeParse({ version: 1, seats: { total: -3 } }).success,
    ).toBe(false);
    expect(
      tenantLimitsSchema.safeParse({ version: 1, seats: { total: 2.5 } }).success,
    ).toBe(false);
    expect(
      tenantLimitsSchema.safeParse({
        version: 1,
        seats: { perProduct: { bridge: 0 } },
      }).success,
    ).toBe(false);
  });

  it("rejects non-positive quota values and a missing version", () => {
    expect(
      tenantLimitsSchema.safeParse({
        version: 1,
        quotas: { cortx: { contexts: -1 } },
      }).success,
    ).toBe(false);
    expect(tenantLimitsSchema.safeParse({ plan: "pro" }).success).toBe(false);
  });
});

describe("provisionRequestSchema — config and limits are optional (backward compatible)", () => {
  it("validates a pre-Phase-2 payload with no config block", () => {
    const r = provisionRequestSchema.parse({
      tenant: TENANT,
      entitlements: ["bridge"],
    });
    expect(r.config).toBeUndefined();
    expect(r.limits).toBeUndefined();
  });

  it("validates a payload carrying the config block", () => {
    const r = provisionRequestSchema.parse({
      tenant: TENANT,
      entitlements: ["bridge"],
      config: { version: 1, brand: "Ascot Insurance", modules: { signing: false } },
    });
    expect(r.config?.modules).toEqual({ signing: false });
  });

  it("validates the full AB-25 payload { tenant, entitlements, config, limits }", () => {
    const r = provisionRequestSchema.parse({
      tenant: TENANT,
      entitlements: ["bridge"],
      config: { version: 1, modules: {} },
      limits: {
        version: TENANT_LIMITS_VERSION,
        plan: "starter",
        seats: { total: 5 },
      },
    });
    expect(r.limits?.plan).toBe("starter");
    expect(r.limits?.seats?.total).toBe(5);
  });

  it("v0.2.0 receivers strip an unknown limits key rather than reject (rollout-safe)", () => {
    // The zod object is non-strict: a v0.2.0 receiver validating a payload that
    // carries the new `limits` block strips it silently — sending limits before
    // a receiver upgrades can never break provisioning (DR-2026-07-18-09).
    const legacyShape = provisionRequestSchema.omit({ limits: true });
    const parsed = legacyShape.parse({
      tenant: TENANT,
      entitlements: ["bridge"],
      limits: { version: 1, seats: { total: 5 } },
    });
    expect("limits" in parsed).toBe(false);
  });
});
