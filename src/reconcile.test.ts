import { describe, it, expect, vi } from "vitest";
import {
  reconcile,
  RECONCILE_DRIFT_MARKER,
  RECONCILE_DRIFT_STATUS,
  type DesiredItem,
} from "./reconcile.js";

// A desired item extended with product-ish fields — proves product payload rides
// on the item without the kit knowing about it.
interface Membership extends DesiredItem {
  workosUserId: string;
  shouldBeActive: boolean;
}

const items: Membership[] = [
  { id: "org:u1", workosUserId: "u1", shouldBeActive: true },
  { id: "org:u2", workosUserId: "u2", shouldBeActive: true },
  { id: "org:u3", workosUserId: "u3", shouldBeActive: true },
];

describe("reconcile — happy path", () => {
  it("reports no drift when actual matches desired (nothing applied)", async () => {
    const apply = vi.fn();
    const report = await reconcile<Membership>({
      source: () => items,
      isDrift: () => ({ drift: false }),
      apply,
      dryRun: false,
    });
    expect(report).toMatchObject({ checked: 3, applied: 0, hasDrift: false, dryRun: false });
    expect(report.drift).toHaveLength(0);
    expect(apply).not.toHaveBeenCalled();
  });
});

describe("reconcile — dry-run first (detect, never write)", () => {
  it("finds drift, records it, but applies nothing and flags hasDrift", async () => {
    const apply = vi.fn();
    const onDrift = vi.fn();
    const logs: string[] = [];
    const report = await reconcile<Membership>({
      source: () => items,
      isDrift: (m) => ({ drift: m.workosUserId !== "u2", detail: "missing product user" }),
      apply,
      dryRun: true,
      onDrift,
      logger: (m) => logs.push(m),
    });
    expect(report.checked).toBe(3);
    expect(report.drift.map((d) => d.id)).toEqual(["org:u1", "org:u3"]);
    expect(report.applied).toBe(0);
    expect(report.hasDrift).toBe(true);
    expect(report.drift.every((d) => d.applied === false)).toBe(true);
    expect(apply).not.toHaveBeenCalled(); // dry-run writes nothing
    expect(onDrift).toHaveBeenCalledTimes(2);
    expect(logs.every((l) => l.includes(RECONCILE_DRIFT_MARKER))).toBe(true);
    expect(logs[0]).toContain("(dry-run)");
    expect(RECONCILE_DRIFT_STATUS).toBe(409); // endpoint maps hasDrift → 409
  });
});

describe("reconcile — confirmed apply", () => {
  it("converges each drifted item and counts it", async () => {
    const applied: string[] = [];
    const report = await reconcile<Membership>({
      source: () => items,
      isDrift: (m) => ({ drift: m.workosUserId === "u1" || m.workosUserId === "u3" }),
      apply: (m) => {
        applied.push(m.workosUserId);
      },
      dryRun: false,
    });
    expect(applied).toEqual(["u1", "u3"]);
    expect(report.applied).toBe(2);
    expect(report.drift.every((d) => d.applied)).toBe(true);
    expect(report.hasDrift).toBe(true);
  });
});

describe("reconcile — resilience (one bad row can't hide the rest)", () => {
  it("records an apply failure, keeps going, and does not throw", async () => {
    const report = await reconcile<Membership>({
      source: () => items,
      isDrift: () => ({ drift: true }),
      apply: (m) => {
        if (m.workosUserId === "u2") throw new Error("write conflict");
      },
      dryRun: false,
    });
    expect(report.drift).toHaveLength(3);
    expect(report.applied).toBe(2); // u1 + u3 converged
    const u2 = report.drift.find((d) => d.id === "org:u2")!;
    expect(u2.applied).toBe(false);
    expect(u2.error).toContain("write conflict");
  });

  it("records a drift-check failure as an anomaly and continues", async () => {
    const report = await reconcile<Membership>({
      source: () => items,
      isDrift: (m) => {
        if (m.workosUserId === "u2") throw new Error("probe timeout");
        return { drift: false };
      },
      apply: vi.fn(),
      dryRun: false,
    });
    expect(report.drift).toHaveLength(1);
    expect(report.drift[0]!.id).toBe("org:u2");
    expect(report.drift[0]!.error).toContain("probe timeout");
    expect(report.hasDrift).toBe(true); // can't confirm in-sync ⇒ treated as drift
  });
});

describe("reconcile — revocation-drift shape (billing-critical)", () => {
  it("serves the opposite polarity: desired=inactive, drift=still-active → deactivate", async () => {
    // Admin says these grants are REVOKED; product still thinks the users active.
    interface RevokedGrant extends DesiredItem {
      workosUserId: string;
    }
    const revoked: RevokedGrant[] = [{ id: "org:u9", workosUserId: "u9" }];
    const stillActive = new Set(["u9"]);
    const deactivated: string[] = [];
    const report = await reconcile<RevokedGrant>({
      source: () => revoked,
      isDrift: (g) => ({ drift: stillActive.has(g.workosUserId), detail: "revoked but active (billable)" }),
      apply: (g) => {
        deactivated.push(g.workosUserId);
      },
      dryRun: false,
    });
    expect(deactivated).toEqual(["u9"]);
    expect(report.drift[0]!.detail).toContain("billable");
    expect(report.applied).toBe(1);
  });
});
