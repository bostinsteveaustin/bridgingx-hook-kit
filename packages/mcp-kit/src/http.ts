/**
 * HTTP-edge helpers lifted from the live Cortx server: the RFC 9728 401
 * wrapper, and rate limiting keyed by a HASH of the bearer (a raw credential
 * must never become a cache key). The limiter itself is injected — Cortx backs
 * it with Upstash; a product without one passes null and skips limiting (a
 * recorded choice, not an accident).
 */
import { createHash } from "node:crypto";
import type { McpRateLimiter } from "./types.js";

/** Key a limiter on the credential without ever storing the credential. */
export function rateLimitKeyFromAuthHeader(authorizationHeader: string | null): string | null {
  if (!authorizationHeader?.startsWith("Bearer ")) return null;
  return `token:${createHash("sha256").update(authorizationHeader.slice(7)).digest("hex")}`;
}

/** Apply the injected limiter. Null response = proceed. */
export async function applyRateLimit(
  req: Request,
  limiter: McpRateLimiter | null,
): Promise<Response | null> {
  if (!limiter) return null;
  const key = rateLimitKeyFromAuthHeader(req.headers.get("authorization"));
  if (!key) return null; // unauthenticated requests die at the identity gate instead
  const verdict = await limiter.check(key);
  if (verdict.allowed) return null;
  const retryAfter = verdict.retryAfterSeconds ?? 60;
  return new Response(
    JSON.stringify({ error: "Rate limit exceeded", retryAfterSeconds: retryAfter }),
    {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter) },
    },
  );
}

/** RFC 9728: point a 401 at the resource metadata so MCP clients can discover
 *  the authorization server. Non-401 responses pass through untouched. */
export function withResourceMetadata(response: Response, resourceMetadataUrl: string): Response {
  if (response.status !== 401) return response;
  const headers = new Headers(response.headers);
  headers.set("WWW-Authenticate", `Bearer resource_metadata="${resourceMetadataUrl}"`);
  return new Response(response.body, {
    status: 401,
    statusText: response.statusText,
    headers,
  });
}
