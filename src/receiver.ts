import type { z } from "zod";
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  resolveSigningSecret,
  verifyPayload,
} from "./signing";

/**
 * Receiver entry points. A conformant product calls exactly one of these inside
 * its route handler — there is no supported path that hand-rolls verification or
 * payload parsing (spec @methodology Phase 1: adopt the package, do not copy).
 *
 * Ordering (spec @decision_logic): verify signature → parse JSON → validate
 * schema → THEN the handler runs its side effects and acknowledges.
 */

/** Minimal header accessor — Web `Headers` and a shim both satisfy this. */
export interface HeadersLike {
  get(name: string): string | null;
}

export interface VerifyIncomingOptions {
  /** Raw request body EXACTLY as received (unparsed). "" for GET /status. */
  rawBody: string;
  headers: HeadersLike;
  /** Registry key selecting the per-product secret; omit to use the shared secret. */
  productKey?: string;
  /** Explicit secret (tests / non-env callers); overrides env resolution. */
  secret?: string;
  env?: NodeJS.ProcessEnv;
}

export type VerifyIncomingResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; reason: string };

/**
 * Verify an incoming signed request. Fail-closed:
 *   - missing secret        → 503 (misconfiguration, not the caller's fault)
 *   - missing/invalid sig    → 401
 */
export function verifyIncoming(opts: VerifyIncomingOptions): VerifyIncomingResult {
  const secret =
    opts.secret ?? resolveSigningSecret(opts.productKey, opts.env);
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

export interface HandleSignedHookOptions<T> extends VerifyIncomingOptions {
  /** The zod schema for this endpoint's payload. */
  schema: z.ZodType<T>;
}

export type SignedHookResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: 400 | 401 | 503; error: string };

/**
 * The one-call receiver helper: verify the signature, then parse + validate the
 * body, returning the typed payload or a status+error to return verbatim. The
 * handler's side effects run only on `{ ok: true }` — and it must acknowledge
 * only after they commit (ack-then-apply).
 */
export function handleSignedHook<T>(
  opts: HandleSignedHookOptions<T>,
): SignedHookResult<T> {
  const verified = verifyIncoming(opts);
  if (!verified.ok) {
    return { ok: false, status: verified.status, error: verified.reason };
  }

  let parsed: unknown;
  try {
    parsed = opts.rawBody === "" ? {} : JSON.parse(opts.rawBody);
  } catch {
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
