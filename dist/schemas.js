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
// --- Live contract (exact current shapes) -----------------------------------
/** POST /provision */
export const provisionRequestSchema = z.object({
    tenant: tenantRefSchema,
    entitlements: z.array(z.string()),
    // NOTE (Phase 2): plan/limits and per-tenant config blocks attach here per the
    // v2 PRD. Omitted now; add as `.extend(...)` when ratified — do not guess.
});
/** POST /deprovision — access teardown, records preserved. */
export const deprovisionRequestSchema = z.object({
    tenant: z.object({ workosOrgId: z.string().min(1) }),
});
// --- v2 endpoint skeletons (extend in Phase 2/3, do not fabricate fields) ----
/** POST /suspend — reversible access revocation, tenant- or user-scoped. */
export const suspendRequestSchema = z.object({
    tenant: z.object({ workosOrgId: z.string().min(1) }),
    scope: z.enum(["tenant", "user"]),
    /** Required when scope === "user". */
    workosUserId: z.string().min(1).optional(),
});
/** POST /reactivate — reverse a suspension; treated as an authoritative re-push. */
export const reactivateRequestSchema = z.object({
    tenant: tenantRefSchema,
    scope: z.enum(["tenant", "user"]),
    workosUserId: z.string().min(1).optional(),
});
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
];
export const hookStateSchema = z.enum(HOOK_STATES);
/** GET /status response. */
export const statusResponseSchema = z.object({
    state: hookStateSchema,
    detail: z.string().optional(),
});
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
/** Build a success ack. */
export function ack(state, detail) {
    return { ok: true, ...(state ? { state } : {}), ...(detail ? { detail } : {}) };
}
/** Build a failure ack. */
export function nack(detail, state = "error") {
    return { ok: false, state, detail };
}
//# sourceMappingURL=schemas.js.map