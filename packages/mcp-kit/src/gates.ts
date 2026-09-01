/**
 * The THREE-GATE SEQUENCER — the kit's centre. Every tool call passes gates in
 * this order, deny default, no reordering, no skipping:
 *
 *   1. IDENTITY   — the bearer resolved to a full caller context (kit-decided).
 *   2. MODULE     — the tenant has the module active (CONSUMER-supplied).
 *   3. CAPABILITY — this caller may use THIS tool (CONSUMER-supplied).
 *
 * The kit sequences; the product supplies gates 2 and 3 as functions. A product
 * cannot forget a gate (wrapping is the only way in) and cannot leak which gate
 * denied (every denial is the same byte-identical result — see errors.ts).
 * Every call is audited, allowed or denied, with the deciding gate named in the
 * record but never in the response.
 *
 * This sequencing-as-structure exists because the discovery found its absence
 * live: Cortx computed scopes at the door and no tool ever consulted them —
 * the guard-shares-the-code-path failure (DR-18 v1.1) in MCP costume.
 */
import type { McpAuthInfo, McpCallerContext, McpToolResult } from "./types.js";
import { resolveCallerContext } from "./context.js";
import { deniedResult } from "./errors.js";
import { hashArgs, safeWrite, type McpAuditWriter, type McpGate } from "./audit.js";

export interface McpGates {
  /** Gate 2 — is the module active for this tenant? Product-supplied. */
  moduleActive(context: McpCallerContext): boolean | Promise<boolean>;
  /** Gate 3 — may this caller use this specific tool? Product-supplied.
   *  (DR-2026-09-01-01: Cortx passes permissive initially; tightened in a
   *  separate commit with the granted-scopes report attached.) */
  toolAllowed(context: McpCallerContext, toolName: string): boolean | Promise<boolean>;
}

export type McpToolHandler = (
  args: unknown,
  context: McpCallerContext,
) => Promise<McpToolResult> | McpToolResult;

/**
 * Wrap a tool handler in the gate sequence. The returned function matches the
 * `mcp-handler` registration shape structurally: (args, extra) where
 * extra.authInfo carries the verified bearer's AuthInfo.
 */
export function guardToolCall(opts: {
  toolName: string;
  gates: McpGates;
  audit: McpAuditWriter;
  handler: McpToolHandler;
}) {
  const { toolName, gates, audit, handler } = opts;

  return async (args: unknown, extra?: { authInfo?: McpAuthInfo }): Promise<McpToolResult> => {
    const argsHash = hashArgs(args);
    const timestamp = new Date().toISOString(); // ISO-8601, explicit UTC offset (Z)

    const deny = async (gate: McpGate, context: McpCallerContext | null): Promise<McpToolResult> => {
      await safeWrite(audit, {
        caller: context?.userId ?? "(unauthenticated)",
        tenant: context?.orgId ?? "(none)",
        tool: toolName,
        argsHash,
        decision: "denied",
        gate,
        timestamp,
      });
      return deniedResult();
    };

    // Gate 1 — identity (kit-decided, fail-closed).
    const context = resolveCallerContext(extra?.authInfo ?? null);
    if (!context) return deny("identity", null);

    // Gate 2 — module active (consumer-supplied). Deny default: a throwing
    // gate is a denying gate.
    let moduleOk = false;
    try {
      moduleOk = await gates.moduleActive(context);
    } catch {
      moduleOk = false;
    }
    if (!moduleOk) return deny("module", context);

    // Gate 3 — per-tool capability (consumer-supplied). Same posture.
    let toolOk = false;
    try {
      toolOk = await gates.toolAllowed(context, toolName);
    } catch {
      toolOk = false;
    }
    if (!toolOk) return deny("capability", context);

    await safeWrite(audit, {
      caller: context.userId,
      tenant: context.orgId,
      tool: toolName,
      argsHash,
      decision: "allowed",
      gate: null,
      timestamp,
    });
    return handler(args, context);
  };
}
