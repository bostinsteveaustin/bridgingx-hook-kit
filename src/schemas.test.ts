import { describe, it, expect } from "vitest";
import {
  provisionRequestSchema,
  tenantConfigSchema,
  TENANT_CONFIG_VERSION,
  tenantLimitsSchema,
  TENANT_LIMITS_VERSION,
  usageReportSchema,
  USAGE_REPORT_VERSION,
  userRequestSchema,
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

describe("usageReportSchema (Metering Phase 5, DR-2026-07-20-11)", () => {
  const DAY = {
    schemaVersion: USAGE_REPORT_VERSION,
    product: "bridge_ci",
    workosOrgId: "org_1",
    periodStart: "2026-07-19",
    periodEnd: "2026-07-19",
    metrics: { deal_rotors_total: 42 },
  };

  it("accepts a daily org rollup and an optional byUser breakdown", () => {
    expect(usageReportSchema.parse(DAY).metrics.deal_rotors_total).toBe(42);
    const withUsers = usageReportSchema.parse({
      ...DAY,
      byUser: [
        { workosUserId: "user_1", metrics: { ai_tokens_in: 100, ai_tokens_out: 40 } },
        { email: "maggie@acme.test", metrics: { ai_tokens: 7 } },
      ],
    });
    expect(withUsers.byUser).toHaveLength(2);
  });

  it("stores unknown metric keys (forward-compatible, opaque to the control plane)", () => {
    const r = usageReportSchema.parse({
      ...DAY,
      metrics: { some_future_metric: 1, another: 0 },
    });
    expect(r.metrics.some_future_metric).toBe(1);
  });

  it("enforces v1 daily grain: periodEnd must equal periodStart", () => {
    expect(
      usageReportSchema.safeParse({ ...DAY, periodEnd: "2026-07-20" }).success,
    ).toBe(false);
  });

  it("rejects malformed dates, empty product/org, and missing metrics", () => {
    expect(usageReportSchema.safeParse({ ...DAY, periodStart: "19-07-2026", periodEnd: "19-07-2026" }).success).toBe(false);
    expect(usageReportSchema.safeParse({ ...DAY, periodStart: "2026-7-19", periodEnd: "2026-7-19" }).success).toBe(false);
    expect(usageReportSchema.safeParse({ ...DAY, product: "" }).success).toBe(false);
    expect(usageReportSchema.safeParse({ ...DAY, workosOrgId: "" }).success).toBe(false);
    expect(usageReportSchema.safeParse({ schemaVersion: 1, product: "cortx", workosOrgId: "org_1", periodStart: "2026-07-19", periodEnd: "2026-07-19" }).success).toBe(false);
  });

  it("rejects non-finite metric values (JSON.parse admits 1e999 as Infinity)", () => {
    const viaJson = JSON.parse('{"tokens": 1e999}') as Record<string, number>;
    expect(Number.isFinite(viaJson.tokens)).toBe(false);
    expect(usageReportSchema.safeParse({ ...DAY, metrics: viaJson }).success).toBe(false);
  });

  it("requires an identifier on every byUser row and caps the array", () => {
    expect(
      usageReportSchema.safeParse({ ...DAY, byUser: [{ metrics: { t: 1 } }] }).success,
    ).toBe(false);
    const flood = Array.from({ length: 5001 }, (_, i) => ({
      workosUserId: `user_${i}`,
      metrics: { t: 1 },
    }));
    expect(usageReportSchema.safeParse({ ...DAY, byUser: flood }).success).toBe(false);
  });
});

describe("userRequestSchema (AB-22 /user grant lifecycle)", () => {
  const BASE = { tenant: { workosOrgId: "org_1" }, user: { workosUserId: "user_1" } };

  it("accepts a grant signal with product keys and an email", () => {
    const r = userRequestSchema.parse({
      ...BASE,
      user: { workosUserId: "user_1", email: "m@acme.test" },
      grants: ["bridge-ci", "cortx"],
      action: "grant",
    });
    expect(r.action).toBe("grant");
    expect(r.grants).toEqual(["bridge-ci", "cortx"]);
  });

  it("accepts a bare revoke (grants optional, email optional)", () => {
    const r = userRequestSchema.parse({ ...BASE, action: "revoke" });
    expect(r.action).toBe("revoke");
    expect(r.grants).toBeUndefined();
    expect(r.user.email).toBeUndefined();
  });

  it("requires tenant.workosOrgId and user.workosUserId; rejects unknown actions", () => {
    expect(userRequestSchema.safeParse({ tenant: {}, user: { workosUserId: "u" } }).success).toBe(false);
    expect(userRequestSchema.safeParse({ tenant: { workosOrgId: "o" }, user: {} }).success).toBe(false);
    expect(userRequestSchema.safeParse({ ...BASE, action: "promote" }).success).toBe(false);
  });

  it("accepts the AB-07 admin marker (Option 3, optional boolean)", () => {
    expect(userRequestSchema.parse({ ...BASE, action: "grant", admin: true }).admin).toBe(true);
    expect(userRequestSchema.parse({ ...BASE, action: "grant" }).admin).toBeUndefined();
    expect(userRequestSchema.safeParse({ ...BASE, admin: "yes" }).success).toBe(false);
  });

  it("still strips an unratified richer role block (Option 2 not fabricated)", () => {
    const r = userRequestSchema.parse({ ...BASE, action: "grant", roles: { "bridge-ci": "editor" } });
    expect("roles" in r).toBe(false);
  });
});
