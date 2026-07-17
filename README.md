# @bridgingx/hook-kit

The **single source of construction** for the BX Admin ↔ product boundary. Every
receiver (Cortx, Bridge, and future Nexs/Xtract) verifies signatures and
validates payloads through this package — **no product re-implements hook
verification**. This closes the tolerant-verifier drift the field audit found
(one receiver had grown three signature-header aliases and multiple timestamp
encodings).

Authoritative spec: **BX Admin Boundary — Receiver Conformance Specification**
(Cortx ctx `e5f4338b-fe00-4401-9e65-672a450a3522`). Where this package and the
spec differ, the spec wins.

## What it provides

- **Strict HMAC verification** (`verifyPayload`, `verifyIncoming`) — HMAC-SHA256
  over `` `${timestamp}.${body}` ``, single header pair (`X-Hook-Signature:
  sha256=<hex>`, `X-Hook-Timestamp: <unix-seconds>`), `/^sha256=[0-9a-f]{64}$/i`
  format gate, constant-time compare, 300s replay window, fail-closed (503) on
  missing secret. **No header aliases, no alternative timestamp formats, no
  tolerant parsing.**
- **Per-product secret resolution** (`resolveSigningSecret`) —
  `PRODUCT_HOOK_SIGNING_SECRET_<KEY>` with a deprecated shared-secret fallback.
- **Zod payload schemas** — `/provision`, `/deprovision`, `/status` (live
  contract, exact); `/suspend`, `/reactivate`, `/user` (v2 skeletons — detailed
  plan/limits/config/role blocks land in Phase 2/3 per the v2 PRD).
- **Normalised status vocabulary + ack helpers** (`HOOK_STATES`, `ack`, `nack`)
  so Admin compares like with like (seeds AB-21).
- **Client posture** (`HookClient`) for Admin's sending side —
  `redirect: "manual"`, 10s timeout, retry 3× on 5xx/network only.

## Receiver usage (one call — nothing to hand-roll)

```ts
import { handleSignedHook, provisionRequestSchema, ack } from "@bridgingx/hook-kit";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const result = handleSignedHook({
    rawBody,
    headers: req.headers,          // Web Headers
    productKey: "cortx",           // → PRODUCT_HOOK_SIGNING_SECRET_CORTX
    schema: provisionRequestSchema,
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });

  // ...apply the payload; ACKNOWLEDGE ONLY AFTER the local write commits...
  return Response.json(ack("provisioned"));
}
```

`verifyIncoming` (verification only) and `verifyPayload` (pure crypto) are also
exported for `GET /status` and lower-level needs.

## Scripts

`pnpm build` (tsc → `dist/`) · `pnpm test` (vitest) · `pnpm typecheck`.
