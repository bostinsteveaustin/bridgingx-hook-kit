/**
 * ONE audit shape for every MCP tool call across every product (Phase 0 order):
 * caller, tenant, tool, args hash, decision, deciding gate, ISO-8601 timestamp
 * with offset. The kit produces records; the PRODUCT supplies the writer
 * (Bridge: ci_audit_events from day one; Cortx: log-line writer until its
 * persistent writer lands). The kit itself touches no database.
 */
import { createHash } from "node:crypto";

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
export function hashArgs(args: unknown): string {
  return createHash("sha256").update(canonicalise(args)).digest("hex");
}

function canonicalise(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalise).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalise(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

/** A writer that must never break the call path: writer failures are logged,
 *  not thrown — an audit outage must not take tools down with it. */
export function safeWrite(writer: McpAuditWriter, record: McpAuditRecord): Promise<void> {
  return Promise.resolve()
    .then(() => writer(record))
    .catch((e) => {
      console.error(
        `[mcp-kit][ALERT] audit writer failed for tool ${record.tool} (${record.decision}): ` +
          `${e instanceof Error ? e.message : e}`,
      );
    });
}
