/**
 * Gate-sequencer tests — the release conditions made executable:
 * one DENIAL test per gate, the allowed path, audit records for every outcome,
 * and the indistinguishability proof: a denied caller cannot tell "no such
 * resource" from "not permitted".
 */
import { describe, expect, it } from "vitest";

import { guardToolCall, type McpGates } from "./gates.js";
import { deniedResult, notFoundResult, jsonResult, DENIED_TEXT } from "./errors.js";
import type { McpAuditRecord } from "./audit.js";
import type { McpAuthInfo } from "./types.js";

const AUTH: McpAuthInfo = {
  token: "t",
  clientId: "user-1",
  scopes: ["read"],
  extra: { userId: "user-1", orgId: "org-1" },
};

function harness(overrides: Partial<McpGates> = {}) {
  const records: McpAuditRecord[] = [];
  const gates: McpGates = {
    moduleActive: () => true,
    toolAllowed: () => true,
    ...overrides,
  };
  const wrapped = guardToolCall({
    toolName: "test_tool",
    gates,
    audit: (r) => {
      records.push(r);
    },
    handler: () => jsonResult({ ok: true }),
  });
  return { wrapped, records };
}

describe("three-gate sequencer", () => {
  it("allows a fully-gated call and audits it with gate=null", async () => {
    const { wrapped, records } = harness();
    const result = await wrapped({ a: 1 }, { authInfo: AUTH });
    expect(result.isError).toBeUndefined();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      caller: "user-1",
      tenant: "org-1",
      tool: "test_tool",
      decision: "allowed",
      gate: null,
    });
    expect(records[0]!.argsHash).toMatch(/^[0-9a-f]{64}$/);
    // ISO-8601 with explicit offset (Z).
    expect(records[0]!.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("GATE 1 denial: missing identity is denied and audited as identity", async () => {
    const { wrapped, records } = harness();
    const result = await wrapped({}, { authInfo: undefined });
    expect(result).toEqual(deniedResult());
    expect(records[0]).toMatchObject({
      caller: "(unauthenticated)",
      tenant: "(none)",
      decision: "denied",
      gate: "identity",
    });
  });

  it("GATE 1 denial: partial identity (orgId missing) is NO identity", async () => {
    const { wrapped, records } = harness();
    const partial: McpAuthInfo = { ...AUTH, extra: { userId: "user-1" } };
    const result = await wrapped({}, { authInfo: partial });
    expect(result).toEqual(deniedResult());
    expect(records[0]!.gate).toBe("identity");
  });

  it("GATE 2 denial: inactive module is denied and audited as module", async () => {
    const { wrapped, records } = harness({ moduleActive: () => false });
    const result = await wrapped({}, { authInfo: AUTH });
    expect(result).toEqual(deniedResult());
    expect(records[0]).toMatchObject({ decision: "denied", gate: "module", caller: "user-1" });
  });

  it("GATE 3 denial: disallowed tool is denied and audited as capability", async () => {
    const { wrapped, records } = harness({ toolAllowed: () => false });
    const result = await wrapped({}, { authInfo: AUTH });
    expect(result).toEqual(deniedResult());
    expect(records[0]).toMatchObject({ decision: "denied", gate: "capability" });
  });

  it("a THROWING consumer gate denies instead of allowing (deny default)", async () => {
    const { wrapped, records } = harness({
      moduleActive: () => {
        throw new Error("gate exploded");
      },
    });
    const result = await wrapped({}, { authInfo: AUTH });
    expect(result).toEqual(deniedResult());
    expect(records[0]!.gate).toBe("module");
  });

  it("gate order holds: identity decides before module, module before capability", async () => {
    // All three would deny; only the FIRST in sequence may be recorded.
    const { wrapped, records } = harness({
      moduleActive: () => false,
      toolAllowed: () => false,
    });
    await wrapped({}, { authInfo: undefined });
    expect(records[0]!.gate).toBe("identity");
    records.length = 0;
    await wrapped({}, { authInfo: AUTH });
    expect(records[0]!.gate).toBe("module");
  });

  it("INDISTINGUISHABILITY: gate denial and not-found are byte-identical", async () => {
    // The release condition: a denied caller cannot learn whether the rotor
    // exists. Both shapes must be exactly equal — same text, same structure.
    const { wrapped } = harness({ toolAllowed: () => false });
    const denied = await wrapped({ rotorId: "exists-or-not" }, { authInfo: AUTH });
    expect(JSON.stringify(denied)).toBe(JSON.stringify(notFoundResult()));
    expect(denied.content[0]!.text).toBe(DENIED_TEXT);
    // And the text names neither gate, capability, nor resource.
    expect(denied.content[0]!.text).not.toMatch(/rotor|capabilit|module|permission|denied/i);
  });

  it("a failing audit writer never breaks the call (loud, not fatal)", async () => {
    const wrapped = guardToolCall({
      toolName: "test_tool",
      gates: { moduleActive: () => true, toolAllowed: () => true },
      audit: () => {
        throw new Error("audit store down");
      },
      handler: () => jsonResult({ ok: true }),
    });
    const result = await wrapped({}, { authInfo: AUTH });
    expect(result.isError).toBeUndefined();
  });
});
