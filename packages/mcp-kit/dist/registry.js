/** The description actually registered: always carries the grain. */
export function composeDescription(def) {
    const base = def.description.trim();
    const suffix = `Exposure: ${def.grain.trim()}`;
    return base.endsWith(".") ? `${base} ${suffix}` : `${base}. ${suffix}`;
}
/** Registry invariants, assertable in tests and at registration time. */
export function assertToolDefinitions(defs) {
    const seen = new Set();
    for (const d of defs) {
        if (!d.name || !/^[a-z][a-z0-9_]*$/.test(d.name)) {
            throw new Error(`[mcp-kit] tool name "${d.name}" must be lower_snake_case.`);
        }
        if (seen.has(d.name))
            throw new Error(`[mcp-kit] duplicate tool name "${d.name}".`);
        seen.add(d.name);
        if (!d.grain || d.grain.trim().length === 0) {
            throw new Error(`[mcp-kit] tool "${d.name}" declares no exposure grain - required.`);
        }
        if (!d.description || d.description.trim().length === 0) {
            throw new Error(`[mcp-kit] tool "${d.name}" has no description.`);
        }
    }
}
//# sourceMappingURL=registry.js.map