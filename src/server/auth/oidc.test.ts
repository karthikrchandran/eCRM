import { describe, expect, it } from "vitest";
import { OidcError, resolveOidcCallback, type OidcCallbackInput } from "./oidc";

const base: OidcCallbackInput = {
  claims: {
    iss: "https://issuer.example.test",
    sub: "subject-1",
    aud: "ecrm-client",
    exp: Math.floor(Date.now() / 1000) + 300,
    nonce: "nonce-1",
    state: "state-1",
    email: "person@example.test",
    email_verified: true,
    name: "Person Example"
  },
  expectedIssuer: "https://issuer.example.test",
  expectedAudience: "ecrm-client",
  expectedNonce: "nonce-1",
  expectedState: "state-1"
};

const activeMembership = {
  id: "membership-1",
  userId: "user-1",
  organizationId: "org-1",
  role: "SALES" as const,
  status: "ACTIVE" as const,
  updatedAt: new Date("2026-08-10T00:00:00.000Z"),
  organization: { status: "ACTIVE" as const },
  user: { id: "user-1", name: "Local Person", email: "local@example.test", active: true }
};

describe("resolveOidcCallback", () => {
  it.each(["bad-state", "bad-nonce", "wrong-issuer", "wrong-audience", "expired"])(
    "rejects %s",
    async (fault) => {
      const input = { ...base, expectedNonce: fault === "bad-nonce" ? "different" : base.expectedNonce };
      if (fault === "bad-state") input.claims = { ...input.claims, state: "bad" };
      if (fault === "wrong-issuer") input.claims = { ...input.claims, iss: "https://evil.example.test" };
      if (fault === "wrong-audience") input.claims = { ...input.claims, aud: "other-client" };
      if (fault === "expired") input.claims = { ...input.claims, exp: Math.floor(Date.now() / 1000) - 1 };
      await expect(resolveOidcCallback(input, { findMembership: async () => activeMembership })).rejects.toBeInstanceOf(OidcError);
    }
  );

  it("creates a session from local active membership, not token roles", async () => {
    const session = await resolveOidcCallback(
      { ...base, claims: { ...base.claims, roles: ["ADMIN"] } },
      { findMembership: async () => activeMembership }
    );
    expect(session.role).toBe("SALES");
    expect(session.organizationId).toBe("org-1");
    expect(session.email).toBe("local@example.test");
  });

  it("rejects an identity without an active local membership", async () => {
    await expect(resolveOidcCallback(base, { findMembership: async () => null })).rejects.toBeInstanceOf(OidcError);
  });
});
