import { resolveCallerContext } from "./context.js";
import { deniedResult } from "./errors.js";
import { hashArgs, safeWrite } from "./audit.js";
/**
 * Wrap a tool handler in the gate sequence. The returned function matches the
 * `mcp-handler` registration shape structurally: (args, extra) where
 * extra.authInfo carries the verified bearer's AuthInfo.
 */
export function guardToolCall(opts) {
    const { toolName, gates, audit, handler } = opts;
    return async (args, extra) => {
        const argsHash = hashArgs(args);
        const timestamp = new Date().toISOString(); // ISO-8601, explicit UTC offset (Z)
        const deny = async (gate, context) => {
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
        if (!context)
            return deny("identity", null);
        // Gate 2 — module active (consumer-supplied). Deny default: a throwing
        // gate is a denying gate.
        let moduleOk = false;
        try {
            moduleOk = await gates.moduleActive(context);
        }
        catch {
            moduleOk = false;
        }
        if (!moduleOk)
            return deny("module", context);
        // Gate 3 — per-tool capability (consumer-supplied). Same posture.
        let toolOk = false;
        try {
            toolOk = await gates.toolAllowed(context, toolName);
        }
        catch {
            toolOk = false;
        }
        if (!toolOk)
            return deny("capability", context);
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
//# sourceMappingURL=gates.js.map