/**
 * Shared MCP types — deliberately STRUCTURAL, with no import from the MCP SDK
 * or any transport package: the kit sequences and shapes, the consuming product
 * owns its transport (Cortx uses `mcp-handler`; Bridge will too). Keeping the
 * kit dependency-light is what lets both consume it from a git tag without
 * dragging a transport version pin across products.
 */
export {};
//# sourceMappingURL=types.js.map