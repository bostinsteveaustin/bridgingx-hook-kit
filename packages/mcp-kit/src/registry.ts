/**
 * Tool-registry conventions. The EXPOSURE GRAIN is a required, structural field
 * — not a hope that authors remember to mention it. The composed description
 * always ends with an "Exposure:" sentence (Bridge v1 states "rotor-grain: a
 * caller sees all fields of a visible rotor, or nothing" per DR-2026-08-29-03),
 * so no tool can ship with its grain unstated.
 */
import type { McpToolResult } from "./types.js";
import type { McpToolHandler } from "./gates.js";

export interface McpToolDefinition {
  /** Product-prefixed tool name, e.g. "bridge_list_rotors". */
  name: string;
  title: string;
  /** What the tool does — WITHOUT the grain sentence; composeDescription adds it. */
  description: string;
  /** The exposure grain, stated per the governing DR — e.g. "rotor-grain: a
   *  caller sees all fields of a visible rotor, or nothing". REQUIRED. */
  grain: string;
  /** The consumer's schema object (Zod raw shape for mcp-handler). Opaque here. */
  inputSchema: unknown;
  handler: McpToolHandler;
}

/** The description actually registered: always carries the grain. */
export function composeDescription(def: Pick<McpToolDefinition, "description" | "grain">): string {
  const base = def.description.trim();
  const suffix = `Exposure: ${def.grain.trim()}`;
  return base.endsWith(".") ? `${base} ${suffix}` : `${base}. ${suffix}`;
}

/** Registry invariants, assertable in tests and at registration time. */
export function assertToolDefinitions(defs: readonly McpToolDefinition[]): void {
  const seen = new Set<string>();
  for (const d of defs) {
    if (!d.name || !/^[a-z][a-z0-9_]*$/.test(d.name)) {
      throw new Error(`[mcp-kit] tool name "${d.name}" must be lower_snake_case.`);
    }
    if (seen.has(d.name)) throw new Error(`[mcp-kit] duplicate tool name "${d.name}".`);
    seen.add(d.name);
    if (!d.grain || d.grain.trim().length === 0) {
      throw new Error(`[mcp-kit] tool "${d.name}" declares no exposure grain - required.`);
    }
    if (!d.description || d.description.trim().length === 0) {
      throw new Error(`[mcp-kit] tool "${d.name}" has no description.`);
    }
  }
}

export type { McpToolResult };
