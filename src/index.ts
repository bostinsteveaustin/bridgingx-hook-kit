/**
 * @bridgingx/hook-kit — the single source of construction for the BX Admin ↔
 * product boundary. Every receiver verifies + validates through this package;
 * no product re-implements verification (Receiver Conformance Specification,
 * Cortx ctx e5f4338b).
 */
export {
  TIMESTAMP_TOLERANCE_SECONDS,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  resolveSigningSecret,
  signPayload,
  verifyPayload,
  type SignHeaders,
  type VerifyResult,
} from "./signing.js";

export {
  tenantRefSchema,
  TENANT_CONFIG_VERSION,
  tenantConfigSchema,
  TENANT_LIMITS_VERSION,
  tenantLimitsSchema,
  provisionRequestSchema,
  deprovisionRequestSchema,
  suspendRequestSchema,
  reactivateRequestSchema,
  userRequestSchema,
  statusResponseSchema,
  hookAckSchema,
  hookStateSchema,
  HOOK_STATES,
  ack,
  nack,
  USAGE_REPORT_VERSION,
  usageReportSchema,
  usageReportUserSchema,
  type TenantRef,
  type TenantConfig,
  type TenantLimits,
  type ProvisionRequest,
  type DeprovisionRequest,
  type SuspendRequest,
  type ReactivateRequest,
  type UserRequest,
  type StatusResponse,
  type HookAck,
  type HookState,
  type UsageReport,
  type UsageReportUser,
} from "./schemas.js";

export {
  verifyIncoming,
  handleSignedHook,
  type HeadersLike,
  type VerifyIncomingOptions,
  type VerifyIncomingResult,
  type HandleSignedHookOptions,
  type SignedHookResult,
} from "./receiver.js";

export { HookClient, type HookClientOptions } from "./client.js";

/**
 * Reconciliation engine (DR-13). Re-exported here for zod-4 consumers (e.g. BX
 * Admin). zod-3 consumers (e.g. Cortx) MUST import from the dedicated
 * `@bridgingx/hook-kit/reconcile` subpath instead — that module is zod-free and
 * pulls in none of the schema code, so it does not force a zod-4 bump.
 */
export {
  reconcile,
  RECONCILE_DRIFT_MARKER,
  RECONCILE_DRIFT_STATUS,
  type DesiredItem,
  type Outcome,
  type DriftRecord,
  type ReconcileReport,
  type ReconcileOptions,
} from "./reconcile.js";
