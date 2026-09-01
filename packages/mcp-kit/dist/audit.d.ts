export type McpGate = "identity" | "module" | "capability";
export interface McpAuditRecord {
    /** Product-local user id, or "(unauthenticated)" when identity failed. */
    caller: string;
    /** Org id, or "(none)" when identity failed before tenancy resolved. */
    tenant: string;
    tool: string;
    /** sha256 of the canonicalised args — never the args themselves: tool
     *  arguments can contain client text and belong in no log. */
    argsHash: string;
    decision: "allowed" | "denied";
    /** The gate that decided a denial; null for an allowed call. */
    gate: McpGate | null;
    /** ISO-8601 with explicit offset (UTC, `Z`). */
    timestamp: string;
}
export type McpAuditWriter = (record: McpAuditRecord) => void | Promise<void>;
/**
 * Canonical args hash: stable across key order so the same call always hashes
 * the same. Arrays keep order (order is meaning); object keys are sorted.
 */
export declare function hashArgs(args: unknown): string;
/** A writer that must never break the call path: writer failures are logged,
 *  not thrown — an audit outage must not take tools down with it. */
export declare function safeWrite(writer: McpAuditWriter, record: McpAuditRecord): Promise<void>;
//# sourceMappingURL=audit.d.ts.map