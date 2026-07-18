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
 * their detailed plan/limits, per-tenant config, and (user × product → role)
 * blocks are ratified in the BX Admin Boundary v2 PRD (Phases 2–3) and are
 * DELIBERATELY LEFT as extensible skeletons here — do not invent those fields.
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
