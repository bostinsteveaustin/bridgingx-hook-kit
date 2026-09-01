import type { McpRateLimiter } from "./types.js";
/** Key a limiter on the credential without ever storing the credential. */
export declare function rateLimitKeyFromAuthHeader(authorizationHeader: string | null): string | null;
/** Apply the injected limiter. Null response = proceed. */
export declare function applyRateLimit(req: Request, limiter: McpRateLimiter | null): Promise<Response | null>;
/** RFC 9728: point a 401 at the resource metadata so MCP clients can discover
 *  the authorization server. Non-401 responses pass through untouched. */
export declare function withResourceMetadata(response: Response, resourceMetadataUrl: string): Response;
//# sourceMappingURL=http.d.ts.map