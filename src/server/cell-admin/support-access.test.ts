// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { authorizeSupportAccess, issueSupportAccessToken, SupportAccessDeniedError } from "./support-access";

const secret = "support-access-secret-that-is-at-least-32-bytes";
const runtime = { mode: "cell", cellId: "cell_ara", cellKey: "ara" } as const;
const grant = {
  id: "grant_1", cellId: "cell_ara", operatorId: "support@example.com", caseReference: "CASE-101",
  capabilities: ["configuration:read"] as const,
  startsAt: new Date("2026-08-11T12:00:00Z"), expiresAt: new Date("2026-08-11T13:00:00Z")
};

describe("scoped support access", () => {
  it("authorizes only a matching active grant and explicit capability and audits success", async () => {
    const token = await issueSupportAccessToken(grant, secret);
    const audit = vi.fn();

    const context = await authorizeSupportAccess(new Request("http://cell/api/support/access", { headers: {
      authorization: `Bearer ${token}`,
      "x-support-operator-id": grant.operatorId,
      "x-support-case-reference": grant.caseReference
    }}), "configuration:read", {
      runtime, secret, now: () => new Date("2026-08-11T12:30:00Z"),
      findControl: async () => ({ cellId: "cell_ara", lifecycleStatus: "ACTIVE" }), findGrant: async () => grant, audit
    });

    expect(context).toMatchObject({ grantId: grant.id, operatorId: grant.operatorId, caseReference: grant.caseReference });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ result: "SUCCEEDED", action: "support-access.configuration:read" }));
  });

  it.each([
    ["operator mismatch", { operator: "other@example.com", caseReference: grant.caseReference, capability: "configuration:read", projected: grant }],
    ["case mismatch", { operator: grant.operatorId, caseReference: "CASE-999", capability: "configuration:read", projected: grant }],
    ["capability excluded", { operator: grant.operatorId, caseReference: grant.caseReference, capability: "users:read", projected: grant }],
    ["revoked", { operator: grant.operatorId, caseReference: grant.caseReference, capability: "configuration:read", projected: { ...grant, revokedAt: new Date("2026-08-11T12:20:00Z") } }]
  ] as const)("denies and audits %s", async (_name, input) => {
    const token = await issueSupportAccessToken(grant, secret);
    const audit = vi.fn();
    await expect(authorizeSupportAccess(new Request("http://cell/api/support/access", { headers: {
      authorization: `Bearer ${token}`,
      "x-support-operator-id": input.operator,
      "x-support-case-reference": input.caseReference
    }}), input.capability, {
      runtime, secret, now: () => new Date("2026-08-11T12:30:00Z"),
      findControl: async () => ({ cellId: "cell_ara", lifecycleStatus: "ACTIVE" }), findGrant: async () => input.projected, audit
    })).rejects.toBeInstanceOf(SupportAccessDeniedError);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ result: "FAILED" }));
  });

  it("denies a valid token when the local lifecycle or grant projection is missing", async () => {
    const token = await issueSupportAccessToken(grant, secret);
    const request = new Request("http://cell/api/support/access", { headers: {
      authorization: `Bearer ${token}`, "x-support-operator-id": grant.operatorId,
      "x-support-case-reference": grant.caseReference
    }});
    await expect(authorizeSupportAccess(request, "configuration:read", {
      runtime, secret, now: () => new Date("2026-08-11T12:30:00Z"),
      findControl: async () => undefined, findGrant: async () => grant, audit: vi.fn()
    })).rejects.toBeInstanceOf(SupportAccessDeniedError);
  });
});
