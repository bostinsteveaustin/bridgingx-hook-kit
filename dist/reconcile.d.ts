/**
 * Adapter-driven reconciliation engine (AB-22 / DR-13).
 *
 * The SINGLE source of the estate's drift-reconciliation loop. Two failure modes
 * run through THIS one loop so the security-and-billing-critical logic exists
 * exactly once (no per-repo copies to drift — the AB-14 lesson):
 *   - PROVISIONING-drift: a member who SHOULD be provisioned but isn't/inactive.
 *   - REVOCATION-drift:  a user REVOKED in Admin but still active — and thus, with
 *                        seat = grant, still BILLABLE — in a product.
 *
 * The kit owns ONLY the orchestration loop + the loud-drift contract. It knows
 * nothing about WorkOS, databases, or any product: the caller supplies three
 * adapters — `source` (desired state), `isDrift` (actual-vs-desired verdict), and
 * `apply` (the convergence write). Product-specific fields ride inside the item
 * type and never leak into the kit.
 *
 * ZERO zod, ZERO imports — plain TS by DESIGN (DR-13 hard constraint). zod-3
 * products (e.g. Cortx, pinned to an early kit) import this from the dedicated
 * `@bridgingx/hook-kit/reconcile` subpath and are NOT forced onto the kit's zod-4
 * schemas. Keep this module import-free.
 *
 * LOUD-DRIFT CONTRACT:
 *   - every drift (and every check that errored) is logged with
 *     `RECONCILE_DRIFT_MARKER` so alerting can grep one string;
 *   - `report.hasDrift` maps to `RECONCILE_DRIFT_STATUS` (409) when the sweep is
 *     exposed as an endpoint — drift is a 409, not a silent 200;
 *   - DRY-RUN FIRST, then confirm-gated apply: run with `dryRun:true` to detect +
 *     report (no writes); re-run with `dryRun:false` only after confirmation to
 *     converge. The engine never writes in dry-run.
 */
/** Loud-drift log marker — alerting greps for exactly this string. */
export declare const RECONCILE_DRIFT_MARKER = "[reconcile-drift]";
/** HTTP status a drift sweep returns when exposed as an endpoint and drift is found. */
export declare const RECONCILE_DRIFT_STATUS = 409;
/**
 * Minimal contract the engine needs on a desired-state item: a stable id used for
 * logging + drift records. Products extend this with their own payload (org id,
 * user id, membership, grant, …); those extra fields are opaque to the kit.
 */
export interface DesiredItem {
    id: string;
}
/** The verdict `isDrift` returns for one item. */
export interface Outcome {
    /** Is the product's ACTUAL state out of sync with this desired item? */
    drift: boolean;
    /** Optional human detail for the drift record + loud log. */
    detail?: string;
}
/** One reconciled item's result in the report. */
export interface DriftRecord {
    id: string;
    detail?: string;
    /** Converged this run? Always false in dry-run, or when a step threw. */
    applied: boolean;
    /** Set when `isDrift` or `apply` threw for this item (sweep continues). */
    error?: string;
}
export interface ReconcileReport {
    /** How many desired items were examined. */
    checked: number;
    /** Items found drifted OR whose drift-check errored. */
    drift: DriftRecord[];
    /** Count converged this run (0 in dry-run). */
    applied: number;
    dryRun: boolean;
    /** Any drift/anomaly found — maps to RECONCILE_DRIFT_STATUS for endpoints. */
    hasDrift: boolean;
}
export interface ReconcileOptions<T extends DesiredItem> {
    /** Desired state — the authoritative set of items that SHOULD hold. */
    source: () => Promise<T[]> | T[];
    /** Verdict: is the product's ACTUAL state out of sync with this item? */
    isDrift: (item: T) => Promise<Outcome> | Outcome;
    /** Converge one drifted item (the product's write). Skipped entirely in dry-run. */
    apply: (item: T) => Promise<void> | void;
    /** true = detect + report only (no writes); false = converge drifted items. */
    dryRun: boolean;
    /** Loud-drift hook — called once per drifted/errored item with its final record. */
    onDrift?: (record: DriftRecord) => void;
    /** Log sink (defaults to console.warn). Injectable for structured logs / tests. */
    logger?: (message: string) => void;
}
/**
 * Run one reconciliation sweep. Never throws for a single item — a failing
 * `isDrift`/`apply` is recorded on that item's record and the sweep continues, so
 * one bad row can't hide drift in the rest of the set.
 */
export declare function reconcile<T extends DesiredItem>(opts: ReconcileOptions<T>): Promise<ReconcileReport>;
//# sourceMappingURL=reconcile.d.ts.map