/**
 * @bridgingx/hook-kit — the single source of construction for the BX Admin ↔
 * product boundary. Every receiver verifies + validates through this package;
 * no product re-implements verification (Receiver Conformance Specification,
 * Cortx ctx e5f4338b).
 */
export { TIMESTAMP_TOLERANCE_SECONDS, SIGNATURE_HEADER, TIMESTAMP_HEADER, resolveSigningSecret, signPayload, verifyPayload, type SignHeaders, type VerifyResult, } from "./signing.js";
export { tenantRefSchema, provisionRequestSchema, deprovisionRequestSchema, suspendRequestSchema, reactivateRequestSchema, userRequestSchema, statusResponseSchema, hookAckSchema, hookStateSchema, HOOK_STATES, ack, nack, type TenantRef, type ProvisionRequest, type DeprovisionRequest, type SuspendRequest, type ReactivateRequest, type UserRequest, type StatusResponse, type HookAck, type HookState, } from "./schemas.js";
export { verifyIncoming, handleSignedHook, type HeadersLike, type VerifyIncomingOptions, type VerifyIncomingResult, type HandleSignedHookOptions, type SignedHookResult, } from "./receiver.js";
export { HookClient, type HookClientOptions } from "./client.js";
//# sourceMappingURL=index.d.ts.map