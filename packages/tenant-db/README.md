# @bridgingx/tenant-db

The estate's shared **tenant-isolation mechanism**: registry contract,
throw-on-unclassified enforcement, scoped-query wrapper, tenant-context
types. Extracted from bridge-v3 `packages/db` per hub ruling
**DR-2026-08-31-01** (Bridge Matters ADR D13, Cortx `837a820d-…`).

**Contract, not content.** This package ships the shape and the
enforcement; each product supplies the data — its own schema and its own
`TENANT_SCOPED_TABLES`, registered at its own call site. No product's
table list ships here. Also deliberately out of scope: per-tenant-DB
routing (bridge-v3's `withTenantDb` / AsyncLocalStorage / catalog).

## Product call site

```ts
import {
  createTenantDb,
  defineTenantRegistry,
  tenantContextFromUser,
  type TenantContext,
} from "@bridgingx/tenant-db";
import { db } from "./client";
import { matters, tasks, users } from "./schema";

// Registered here, in the SAME commit as the schema entry. Unclassified
// tables throw at query time — loud, not silent.
const registry = defineTenantRegistry({
  tenantScoped: [
    [matters, "orgId"],
    [tasks, "orgId"],
  ],
  global: [users],
});

const tdb = createTenantDb({ registry, registerHint: "src/db/tenant-registry.ts" });

export { tenantContextFromUser };
export const { tenantFilter, isTenantScoped, isGlobalTable } = tdb;
export const scopedSelect = (ctx: TenantContext, table: Parameters<typeof tenantFilter>[1]) =>
  tdb.scopedSelect(db, ctx, table);
```

For joins, subqueries and aggregates, compose `tenantFilter(ctx, table)`
into your own `and(...)` — the principled escape hatch that still runs the
classification check.

## Consuming (git tag — the estate standard, DR-2026-08-31-01)

```bash
pnpm add "github:bostinsteveaustin/bridgingx-hook-kit#tenant-db-v0.1.0&path:/packages/tenant-db"
```

`drizzle-orm` (>= 0.38) is a peer dependency — the mechanism operates on
YOUR Drizzle table objects and never bundles its own copy.

## Releasing

`dist/` is committed on purpose (git consumers get prebuilt JS + types,
no install-time build). After any `src/` change: `pnpm build`, commit
`src/` + `dist/` together, tag `tenant-db-vX.Y.Z`, push the tag.

`pnpm build` (tsc → `dist/`) · `pnpm test` (vitest) · `pnpm typecheck`.
