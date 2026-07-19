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
export declare const tenantRefSchema: z.ZodObject<{
    workosOrgId: z.ZodString;
    slug: z.ZodString;
    name: z.ZodString;
}, z.core.$strip>;
export type TenantRef = z.infer<typeof tenantRefSchema>;
/**
 * Config-block schema version carried on the provision payload. Bump when the
 * block's shape changes so a receiver can branch on `config.version`.
 */
export declare const TENANT_CONFIG_VERSION = 1;
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
export declare const tenantConfigSchema: z.ZodObject<{
    version: z.ZodNumber;
    brand: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    modules: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodBoolean>>;
}, z.core.$strip>;
export type TenantConfig = z.infer<typeof tenantConfigSchema>;
/**
 * Limits-block schema version carried on the provision payload. Bump when the
 * block's shape changes so a receiver can branch on `limits.version`.
 */
export declare const TENANT_LIMITS_VERSION = 1;
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
export declare const tenantLimitsSchema: z.ZodObject<{
    version: z.ZodNumber;
    plan: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    seats: z.ZodOptional<z.ZodObject<{
        total: z.ZodOptional<z.ZodNumber>;
        perProduct: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    }, z.core.$strip>>;
    quotas: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodNumber>>>;
}, z.core.$strip>;
export type TenantLimits = z.infer<typeof tenantLimitsSchema>;
/** POST /provision */
export declare const provisionRequestSchema: z.ZodObject<{
    tenant: z.ZodObject<{
        workosOrgId: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>;
    entitlements: z.ZodArray<z.ZodString>;
    config: z.ZodOptional<z.ZodObject<{
        version: z.ZodNumber;
        brand: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        modules: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodBoolean>>;
    }, z.core.$strip>>;
    limits: z.ZodOptional<z.ZodObject<{
        version: z.ZodNumber;
        plan: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        seats: z.ZodOptional<z.ZodObject<{
            total: z.ZodOptional<z.ZodNumber>;
            perProduct: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
        }, z.core.$strip>>;
        quotas: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodNumber>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ProvisionRequest = z.infer<typeof provisionRequestSchema>;
/** POST /deprovision — access teardown, records preserved. */
export declare const deprovisionRequestSchema: z.ZodObject<{
    tenant: z.ZodObject<{
        workosOrgId: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export type DeprovisionRequest = z.infer<typeof deprovisionRequestSchema>;
/** POST /suspend — reversible access revocation, tenant- or user-scoped. */
export declare const suspendRequestSchema: z.ZodObject<{
    tenant: z.ZodObject<{
        workosOrgId: z.ZodString;
    }, z.core.$strip>;
    scope: z.ZodEnum<{
        tenant: "tenant";
        user: "user";
    }>;
    workosUserId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type SuspendRequest = z.infer<typeof suspendRequestSchema>;
/** POST /reactivate — reverse a suspension; treated as an authoritative re-push. */
export declare const reactivateRequestSchema: z.ZodObject<{
    tenant: z.ZodObject<{
        workosOrgId: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>;
    scope: z.ZodEnum<{
        tenant: "tenant";
        user: "user";
    }>;
    workosUserId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ReactivateRequest = z.infer<typeof reactivateRequestSchema>;
/** POST /user — user lifecycle + per-product grant + (user × product → role).
 *  Skeleton: the role block is Phase 3 (role matrix) and is intentionally absent. */
export declare const userRequestSchema: z.ZodObject<{
    tenant: z.ZodObject<{
        workosOrgId: z.ZodString;
    }, z.core.$strip>;
    user: z.ZodObject<{
        workosUserId: z.ZodString;
        email: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    grants: z.ZodOptional<z.ZodArray<z.ZodString>>;
    action: z.ZodOptional<z.ZodEnum<{
        grant: "grant";
        revoke: "revoke";
        suspend: "suspend";
        reactivate: "reactivate";
        delete: "delete";
    }>>;
}, z.core.$strip>;
export type UserRequest = z.infer<typeof userRequestSchema>;
/**
 * Normalised product-applied state (spec @reference_data: GET /status,
 * "normalised granularity"). The SUPERSET every receiver maps into, so Admin
 * compares like with like. `suspended` is first-class in v2 (previously collapsed
 * into `deprovisioned` by some receivers).
 */
export declare const HOOK_STATES: readonly ["pending", "provisioned", "suspended", "deprovisioned", "error"];
export declare const hookStateSchema: z.ZodEnum<{
    error: "error";
    pending: "pending";
    provisioned: "provisioned";
    suspended: "suspended";
    deprovisioned: "deprovisioned";
}>;
export type HookState = (typeof HOOK_STATES)[number];
/** GET /status response. */
export declare const statusResponseSchema: z.ZodObject<{
    state: z.ZodEnum<{
        error: "error";
        pending: "pending";
        provisioned: "provisioned";
        suspended: "suspended";
        deprovisioned: "deprovisioned";
    }>;
    detail: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type StatusResponse = z.infer<typeof statusResponseSchema>;
/**
 * The structured acknowledgement every receiver returns. `ok:true` only after
 * the local write has committed (ack-then-apply, product side). `state` lets a
 * receiver report the state it converged to.
 */
export declare const hookAckSchema: z.ZodObject<{
    ok: z.ZodBoolean;
    state: z.ZodOptional<z.ZodEnum<{
        error: "error";
        pending: "pending";
        provisioned: "provisioned";
        suspended: "suspended";
        deprovisioned: "deprovisioned";
    }>>;
    detail: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type HookAck = z.infer<typeof hookAckSchema>;
/** Build a success ack. */
export declare function ack(state?: HookState, detail?: string): HookAck;
/** Build a failure ack. */
export declare function nack(detail: string, state?: HookState): HookAck;
//# sourceMappingURL=schemas.d.ts.map