import { z } from "zod";

/**
 * Zod payload schemas for every boundary hook. Validation runs BEFORE any side
 * effect in a receiver (spec @decision_logic). These schemas are the shared
 * contract — a receiver MUST validate with them, not a hand-rolled parser
 * (@pitfalls: Tolerant verifier drift extends to payload parsing).
 *
 * SCOPE (Phase 1): `/provision`, `/deprovision`, `/status` are the LIVE contract
 * and are specified exactly as sent today, so migrating receivers onto them is
 * behaviour-preserving. `/suspend`, `/reactivate`, `/user` are the v2 endpoints;
 * their per-tenant config and (user × product → role) blocks are ratified in the
 * BX Admin Boundary v2 PRD (Phases 2–3) and are DELIBERATELY LEFT as extensible
 * skeletons here — do not invent those fields.
 *
 * Phase 2 landings on /provision: `config` (AB-16) and `limits` (AB-25, ratified
 * DR-2026-07-18-10) — both OPTIONAL blocks, so pre-Phase-2 payloads and
 * not-yet-consuming receivers validate unchanged.
 */

/** Tenant identity carried on every hook. Internal/WorkOS ids only — no vendor shapes. */
export const tenantRefSchema = z.object({
  workosOrgId: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
});
export type TenantRef = z.infer<typeof tenantRefSchema>;

// --- Per-tenant configuration (Phase 2, AB-16 / P-01) ------------------------

/**
 * Config-block schema version carried on the provision payload. Bump when the
 * block's shape changes so a receiver can branch on `config.version`.
 */
export const TENANT_CONFIG_VERSION = 1;

/**
 * Admin-owned per-(tenant × product) configuration, pushed on /provision and
 * applied by the receiver (spec @decision_logic: "apply … per-tenant config from
 * the payload"). Admin is the SINGLE source of truth — this replaces config
 * hardcoded in product source (spec @prohibitions / @pitfalls: "No per-tenant
 * configuration hardcoded in source").
 *
 * `modules` is an OPAQUE enable-map: the product owns the module vocabulary; the
 * control plane only stores and forwards keys it does not interpret (product
 * taxonomy stays out of the control plane). A receiver applies the keys it
 * recognises and acks with detail on the rest (spec @decision_logic escalation).
 */
export const tenantConfigSchema = z.object({
  version: z.number().int().positive(),
  /** Display brand shown by the product; null/absent → receiver falls back to tenant name. */
  brand: z.string().nullable().optional(),
  /** Opaque module enable-map: moduleKey → enabled. */
  modules: z.record(z.string(), z.boolean()).default({}),
});
export type TenantConfig = z.infer<typeof tenantConfigSchema>;

// --- Per-tenant plan/limits (Phase 2, AB-25 / DR-2026-07-18-10) --------------

/**
 * Limits-block schema version carried on the provision payload. Bump when the
 * block's shape changes so a receiver can branch on `limits.version`.
 */
export const TENANT_LIMITS_VERSION = 1;

/** A cap is a finite positive integer — junk can never zero-out a limit. */
const capSchema = z.number().int().positive();

/**
 * Admin-owned per-tenant plan/limits, pushed on /provision beside `config`.
 * Replaces the out-of-contract /set-plan path: plan tier + limits now ride the
 * ack-gated, per-product-secret provision contract.
 *
 * Seat semantics are ratified (DR-2026-07-18-10): seat = grant, active =
 * granted, the billing/enforcement count is the number of `_granted` flags per
 * tenant. Admin enforces seat caps at grant time; receivers treat `seats` as
 * display/reporting context, not an enforcement duty.
 *
 * `quotas` is OPAQUE per-product data (same seam as `config.modules`): the
 * product owns its quota vocabulary (e.g. Cortx's contexts/spaces); the control
 * plane stores and forwards keys it never interprets. A receiver reads its own
 * `quotas[<its product key>]` map and applies the keys it recognises.
 */
export const tenantLimitsSchema = z.object({
  version: z.number().int().positive(),
  /** Plan tier identifier (Admin-owned data — commercial tiers are rows, not code). */
  plan: z.string().nullable().optional(),
  /** Seat caps on active grants. Absent field = uncapped. */
  seats: z
    .object({
      /** Tenant-wide cap on active grants across all products. */
      total: capSchema.optional(),
      /** Opt-in per-product sub-caps: productKey → cap (grants are per-product). */
      perProduct: z.record(z.string(), capSchema).optional(),
    })
    .optional(),
  /** Opaque per-product quota maps: productKey → (quotaKey → positive number). */
  quotas: z
    .record(z.string(), z.record(z.string(), z.number().positive()))
    .optional(),
});
export type TenantLimits = z.infer<typeof tenantLimitsSchema>;

// --- Live contract (exact current shapes) -----------------------------------

/** POST /provision */
export const provisionRequestSchema = z.object({
  tenant: tenantRefSchema,
  entitlements: z.array(z.string()),
  /**
   * Per-tenant config block (Phase 2, AB-16). OPTIONAL for backward-compatibility:
   * receivers not yet consuming it, and pre-Phase-2 payloads, still validate — so
   * adding it changes no receiver's behaviour until it opts in.
   */
  config: tenantConfigSchema.optional(),
  /**
   * Per-tenant plan/limits block (Phase 2, AB-25). OPTIONAL for the same
   * backward-compatibility contract as `config`. Absorbs /set-plan.
   */
  limits: tenantLimitsSchema.optional(),
});
export type ProvisionRequest = z.infer<typeof provisionRequestSchema>;

/** POST /deprovision — access teardown, records preserved. */
export const deprovisionRequestSchema = z.object({
  tenant: z.object({ workosOrgId: z.string().min(1) }),
});
export type DeprovisionRequest = z.infer<typeof deprovisionRequestSchema>;

// --- v2 endpoint skeletons (extend in Phase 2/3, do not fabricate fields) ----

/** POST /suspend — reversible access revocation, tenant- or user-scoped. */
export const suspendRequestSchema = z.object({
  tenant: z.object({ workosOrgId: z.string().min(1) }),
  scope: z.enum(["tenant", "user"]),
  /** Required when scope === "user". */
  workosUserId: z.string().min(1).optional(),
});
export type SuspendRequest = z.infer<typeof suspendRequestSchema>;

/** POST /reactivate — reverse a suspension; treated as an authoritative re-push. */
export const reactivateRequestSchema = z.object({
  tenant: tenantRefSchema,
  scope: z.enum(["tenant", "user"]),
  workosUserId: z.string().min(1).optional(),
});
export type ReactivateRequest = z.infer<typeof reactivateRequestSchema>;

/** POST /user — user lifecycle + per-product grant + (user × product → role).
 *  Skeleton: the role block is Phase 3 (role matrix) and is intentionally absent. */
export const userRequestSchema = z.object({
  tenant: z.object({ workosOrgId: z.string().min(1) }),
  user: z.object({
    workosUserId: z.string().min(1),
    email: z.string().optional(),
  }),
  /** Product keys this user is granted (two-flag: drives the `<key>_granted` marker). */
  grants: z.array(z.string()).optional(),
  action: z.enum(["grant", "revoke", "suspend", "reactivate", "delete"]).optional(),
});
export type UserRequest = z.infer<typeof userRequestSchema>;

// --- Status + acknowledgement (shared vocabulary — seeds AB-21) --------------

/**
 * Normalised product-applied state (spec @reference_data: GET /status,
 * "normalised granularity"). The SUPERSET every receiver maps into, so Admin
 * compares like with like. `suspended` is first-class in v2 (previously collapsed
 * into `deprovisioned` by some receivers).
 */
export const HOOK_STATES = [
  "pending",
  "provisioned",
  "suspended",
  "deprovisioned",
  "error",
] as const;
export const hookStateSchema = z.enum(HOOK_STATES);
export type HookState = (typeof HOOK_STATES)[number];

/** GET /status response. */
export const statusResponseSchema = z.object({
  state: hookStateSchema,
  detail: z.string().optional(),
});
export type StatusResponse = z.infer<typeof statusResponseSchema>;

/**
 * The structured acknowledgement every receiver returns. `ok:true` only after
 * the local write has committed (ack-then-apply, product side). `state` lets a
 * receiver report the state it converged to.
 */
export const hookAckSchema = z.object({
  ok: z.boolean(),
  state: hookStateSchema.optional(),
  detail: z.string().optional(),
});
export type HookAck = z.infer<typeof hookAckSchema>;

/** Build a success ack. */
export function ack(state?: HookState, detail?: string): HookAck {
  return { ok: true, ...(state ? { state } : {}), ...(detail ? { detail } : {}) };
}

/** Build a failure ack. */
export function nack(detail: string, state: HookState = "error"): HookAck {
  return { ok: false, state, detail };
}

// --- Usage reporting (Metering Phase 5, DR-2026-07-20-11 / DR-04) ------------

/**
 * Usage-report schema version. Bump when the payload shape changes so the
 * receiver can branch on `schemaVersion`.
 */
export const USAGE_REPORT_VERSION = 1;

/** UTC calendar date, `YYYY-MM-DD` — the metering grain is the day. */
const usageDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

/**
 * Metric map: product-defined keys → finite numbers. Keys are OPAQUE to the
 * control plane (same seam as `config.modules` / `limits.quotas`): unknown keys
 * are stored, never rejected — forward-compatible by construction. `.finite()`
 * matters: JSON.parse accepts `1e999` as Infinity, which must not reach jsonb.
 */
const usageMetricsSchema = z.record(z.string().min(1), z.number().finite());

/** Optional per-user breakdown row. At least one identifier is required. */
export const usageReportUserSchema = z
  .object({
    workosUserId: z.string().min(1).optional(),
    email: z.string().min(1).optional(),
    metrics: usageMetricsSchema,
  })
  .refine((u) => u.workosUserId || u.email, {
    message: "byUser entry requires workosUserId or email",
  });
export type UsageReportUser = z.infer<typeof usageReportUserSchema>;

/**
 * POST /api/usage/report on BX Admin — the ONE sanctioned product-initiated
 * flow (DR-04): async pre-aggregated daily rollups, out of the request path.
 * Direction reverses here: the PRODUCT signs (its per-product secret) and
 * ADMIN verifies via the same canonical envelope — receivers of this schema
 * are the control plane, not products.
 *
 * Semantics (v1): daily grain (`periodEnd === periodStart`); idempotent upsert
 * on (product, workosOrgId, period) — a re-sent day replaces that day; late /
 * backfilled days are legal. Reporting must never block product request paths;
 * a failed send is retried on the reporter's next cron.
 *
 * `product` is the sender's registry key; the receiver canonicalises it
 * (hyphen/underscore-insensitive) against the product registry — senders do
 * not need to know registry-internal spelling.
 */
export const usageReportSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    product: z.string().min(1),
    workosOrgId: z.string().min(1),
    periodStart: usageDateSchema,
    periodEnd: usageDateSchema,
    metrics: usageMetricsSchema,
    /** Optional per-user breakdown. Bounded: a daily rollup for one tenant. */
    byUser: z.array(usageReportUserSchema).max(5000).optional(),
  })
  .refine((r) => r.periodEnd === r.periodStart, {
    message: "v1 is daily grain: periodEnd must equal periodStart",
  });
export type UsageReport = z.infer<typeof usageReportSchema>;
