import { SIGNATURE_HEADER, TIMESTAMP_HEADER, resolveSigningSecret, verifyPayload, } from "./signing";
/**
 * Verify an incoming signed request. Fail-closed:
 *   - missing secret        → 503 (misconfiguration, not the caller's fault)
 *   - missing/invalid sig    → 401
 */
export function verifyIncoming(opts) {
    const secret = opts.secret ?? resolveSigningSecret(opts.productKey, opts.env);
    if (!secret) {
        return { ok: false, status: 503, reason: "Hook signing secret not configured" };
    }
    const signature = opts.headers.get(SIGNATURE_HEADER);
    const timestamp = opts.headers.get(TIMESTAMP_HEADER);
    if (!signature || !timestamp) {
        return { ok: false, status: 401, reason: "Missing signature or timestamp header" };
    }
    const result = verifyPayload(opts.rawBody, signature, timestamp, secret);
    if (!result.valid) {
        return { ok: false, status: 401, reason: result.reason ?? "Unauthorized" };
    }
    return { ok: true };
}
/**
 * The one-call receiver helper: verify the signature, then parse + validate the
 * body, returning the typed payload or a status+error to return verbatim. The
 * handler's side effects run only on `{ ok: true }` — and it must acknowledge
 * only after they commit (ack-then-apply).
 */
export function handleSignedHook(opts) {
    const verified = verifyIncoming(opts);
    if (!verified.ok) {
        return { ok: false, status: verified.status, error: verified.reason };
    }
    let parsed;
    try {
        parsed = opts.rawBody === "" ? {} : JSON.parse(opts.rawBody);
    }
    catch {
        return { ok: false, status: 400, error: "Invalid JSON body" };
    }
    const result = opts.schema.safeParse(parsed);
    if (!result.success) {
        return {
            ok: false,
            status: 400,
            error: `Payload validation failed: ${result.error.issues
                .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
                .join("; ")}`,
        };
    }
    return { ok: true, data: result.data };
}
//# sourceMappingURL=receiver.js.map