/** The single text every gate denial and every not-found produces. Deliberately
 *  generic: names neither the gate, the capability, nor the resource. */
export const DENIED_TEXT = "Not available.";
/** Gate denial — identical to notFoundResult by design. */
export function deniedResult() {
    return { content: [{ type: "text", text: DENIED_TEXT }], isError: true };
}
/**
 * Resource-not-found INSIDE a permitted tool call. Identical to a denial so
 * existence is never inferable from the error shape. Tools that have already
 * passed every gate and want to be helpful about a merely-empty result should
 * return a successful empty payload instead — this is for lookups by id.
 */
export function notFoundResult() {
    return deniedResult();
}
/** Operational failure (a real error, after gates allowed the call). Message
 *  should be safe for the caller; never embed internal identifiers. */
export function errorResult(message) {
    return { content: [{ type: "text", text: message }], isError: true };
}
/** Successful JSON payload. */
export function jsonResult(data) {
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}
//# sourceMappingURL=errors.js.map