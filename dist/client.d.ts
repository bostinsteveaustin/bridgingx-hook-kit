import { type HookAck, type StatusResponse } from "./schemas.js";
export interface HookClientOptions {
    /** The product's hook base URL (bare origin per the spec's status-path note). */
    provisioningUrl: string;
    /** Registry key → per-product signing secret. */
    productKey?: string;
    /** Injectable for tests. Defaults to global fetch. */
    fetchImpl?: typeof fetch;
    /** Injectable backoff (return a promise). Defaults to exponential real sleep. */
    backoff?: (attempt: number) => Promise<void>;
    timeoutMs?: number;
}
export declare class HookClient {
    private readonly base;
    private readonly productKey?;
    private readonly fetchImpl;
    private readonly backoff;
    private readonly timeoutMs;
    constructor(opts: HookClientOptions);
    /** POST a signed hook (`/provision`, `/deprovision`, `/suspend`, `/reactivate`, `/user`). */
    post(path: string, payload: unknown): Promise<HookAck>;
    /** GET /status — signed over an empty body. Returns the product-applied state. */
    status(workosOrgId: string): Promise<StatusResponse>;
    private fetchWithRetry;
}
//# sourceMappingURL=client.d.ts.map