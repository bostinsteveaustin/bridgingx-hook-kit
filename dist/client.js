import { signPayload } from "./signing.js";
import { hookAckSchema, statusResponseSchema, } from "./schemas.js";
/**
 * Admin sending-side client. Signs every call and enforces the required posture
 * (spec @reference_data): `redirect: "manual"` (a compromised/open-redirecting
 * product hook must not 3xx our signed request to an attacker host), 10s timeout,
 * retry 3× on 5xx/network only (4xx = client error, no retry).
 */
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 10_000;
const BACKOFF_BASE_MS = 1000;
export class HookClient {
    base;
    productKey;
    fetchImpl;
    backoff;
    timeoutMs;
    constructor(opts) {
        this.base = opts.provisioningUrl.replace(/\/+$/, "");
        this.productKey = opts.productKey;
        this.fetchImpl = opts.fetchImpl ?? fetch;
        this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        this.backoff =
            opts.backoff ??
                ((attempt) => new Promise((r) => setTimeout(r, BACKOFF_BASE_MS * 2 ** attempt)));
    }
    /** POST a signed hook (`/provision`, `/deprovision`, `/suspend`, `/reactivate`, `/user`). */
    async post(path, payload) {
        const body = JSON.stringify(payload);
        const res = await this.fetchWithRetry(`${this.base}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...signPayload(body, this.productKey) },
            body,
        });
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`Hook ${path} returned ${res.status}: ${text.slice(0, 200)}`);
        }
        const json = await res.json().catch(() => ({ ok: res.ok }));
        // An ack is expected but never trusted blindly — validate, default to the HTTP result.
        const parsed = hookAckSchema.safeParse(json);
        return parsed.success ? parsed.data : { ok: res.ok };
    }
    /** GET /status — signed over an empty body. Returns the product-applied state. */
    async status(workosOrgId) {
        const url = new URL("/status", `${this.base}/`);
        url.searchParams.set("org", workosOrgId);
        const res = await this.fetchWithRetry(url.toString(), {
            method: "GET",
            headers: { ...signPayload("", this.productKey) },
        });
        const json = await res.json();
        return statusResponseSchema.parse(json);
    }
    async fetchWithRetry(url, init) {
        let lastError = null;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const res = await this.fetchImpl(url, {
                    ...init,
                    redirect: "manual",
                    signal: AbortSignal.timeout(this.timeoutMs),
                });
                // Redirects and 4xx are hard, non-retryable (a 3xx could leak the
                // signature to an attacker host; a 4xx is a client error).
                if (res.status >= 300 && res.status < 500)
                    return res;
                if (res.status >= 500) {
                    lastError = new Error(`Server error: ${res.status}`);
                    if (attempt < MAX_RETRIES) {
                        await this.backoff(attempt);
                        continue;
                    }
                    return res;
                }
                return res; // 2xx
            }
            catch (err) {
                lastError = err instanceof Error ? err : new Error("Unknown fetch error");
                if (attempt < MAX_RETRIES) {
                    await this.backoff(attempt);
                    continue;
                }
            }
        }
        throw lastError ?? new Error(`Hook call to ${url} failed after retries`);
    }
}
//# sourceMappingURL=client.js.map