/**
 * @bridgingx/mcp-kit — shared platform MCP plumbing, Phase 0.
 * Scope: what BridgeCI MCP v1 needs and nothing more (build order 2026-09-01;
 * DR-2026-08-29-03, DR-2026-09-01-01). No database access lives here.
 */
export type { McpCallerContext, McpAuthInfo, McpToolResult, McpRateLimiter } from "./types.js";
export {
  PLATFORM_MCP_TOKEN_TAG,
  deriveMcpSigningKey,
  signMcpAccessToken,
  hs256Verifier,
  type McpAccessTokenClaims,
  type McpTokenVerifier,
} from "./jwt.js";
export {
  oauthSource,
  chainSources,
  resolveCallerContext,
  type McpCredentialSource,
} from "./context.js";
export { guardToolCall, type McpGates, type McpToolHandler } from "./gates.js";
export {
  hashArgs,
  safeWrite,
  type McpAuditRecord,
  type McpAuditWriter,
  type McpGate,
} from "./audit.js";
export { DENIED_TEXT, deniedResult, notFoundResult, errorResult, jsonResult } from "./errors.js";
export {
  composeDescription,
  assertToolDefinitions,
  type McpToolDefinition,
} from "./registry.js";
export { rateLimitKeyFromAuthHeader, applyRateLimit, withResourceMetadata } from "./http.js";
