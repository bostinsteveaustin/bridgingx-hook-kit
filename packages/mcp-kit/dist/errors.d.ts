/**
 * Uniform result shapes — and the release condition made structural:
 *
 * A caller denied at a gate MUST NOT be able to distinguish "no such resource"
 * from "not permitted". That is enforced here by construction: `deniedResult()`
 * and `notFoundResult()` return BYTE-IDENTICAL payloads (`notFoundResult` IS
 * `deniedResult`). A product that wants to leak existence has to go around the
 * kit on purpose; it cannot do it by accident.
 */
import type { McpToolResult } from "./types.js";
/** The single text every gate denial and every not-found produces. Deliberately
 *  generic: names neither the gate, the capability, nor the resource. */
export declare const DENIED_TEXT = "Not available.";
/** Gate denial — identical to notFoundResult by design. */
export declare function deniedResult(): McpToolResult;
/**
 * Resource-not-found INSIDE a permitted tool call. Identical to a denial so
 * existence is never inferable from the error shape. Tools that have already
 * passed every gate and want to be helpful about a merely-empty result should
 * return a successful empty payload instead — this is for lookups by id.
 */
export declare function notFoundResult(): McpToolResult;
/** Operational failure (a real error, after gates allowed the call). Message
 *  should be safe for the caller; never embed internal identifiers. */
export declare function errorResult(message: string): McpToolResult;
/** Successful JSON payload. */
export declare function jsonResult(data: unknown): McpToolResult;
//# sourceMappingURL=errors.d.ts.map