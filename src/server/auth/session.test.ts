// @vitest-environment node

import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { shouldUseSecureSessionCookie, signSession, verifySessionToken, type SessionUser } from "./session";

const secret = "12345678901234567890123456789012";
const otherSecret = "abcdefghijklmnopqrstuvwxzy123456";
const issuer = "ecrm";
const audience = "ecrm-session";

const validUser: SessionUser = {
  id: "user_1",
  email: "admin@example.com",
  name: "Admin User",
  organizationId: "org_1",
  membershipId: "membership_1",
  role: "OWNER",
  sessionVersion: 1
};

function encodeSecret(value: string) {
  return new TextEncoder().encode(value);
}

describe("session utilities", () => {
  it("uses secure cookies only for HTTPS application URLs", () => {
    expect(shouldUseSecureSessionCookie("https://crm.example.com")).toBe(true);
    expect(shouldUseSecureSessionCookie("http://127.0.0.1:5050")).toBe(false);
    expect(shouldUseSecureSessionCookie("http://localhost:3000")).toBe(false);
  });

  it("round-trips a signed session token", async () => {
    const token = await signSession(validUser, secret);

    await expect(verifySessionToken(token, secret)).resolves.toMatchObject({
      id: "user_1",
      email: "admin@example.com",
      name: "Admin User",
      organizationId: "org_1",
      membershipId: "membership_1",
      role: "OWNER",
      sessionVersion: 1
    });
  });

  it("returns null for an invalid token", async () => {
    await expect(verifySessionToken("not-a-token", secret)).resolves.toBeNull();
  });

  it("rejects signed tokens missing an expiration claim", async () => {
    const token = await new SignJWT(validUser)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .sign(encodeSecret(secret));

    await expect(verifySessionToken(token, secret)).resolves.toBeNull();
  });

  it("rejects signed tokens created with a different secret", async () => {
    const token = await signSession(validUser, otherSecret);

    await expect(verifySessionToken(token, secret)).resolves.toBeNull();
  });

  it("rejects legacy signed tokens without organization claims", async () => {
    const token = await new SignJWT({
      id: validUser.id,
      email: validUser.email,
      name: validUser.name,
      role: "ADMIN"
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(encodeSecret(secret));

    await expect(verifySessionToken(token, secret)).resolves.toBeNull();
  });

  it.each(["OWNER", "ADMIN", "SALES", "FINANCE", "PRODUCTION", "READ_ONLY"] as const)(
    "accepts the %s organization role",
    async (role) => {
      const token = await signSession({ ...validUser, role }, secret);

      await expect(verifySessionToken(token, secret)).resolves.toMatchObject({ role });
    }
  );

  it("rejects signed tokens with an unknown organization role", async () => {
    const token = await new SignJWT({
      ...validUser,
      role: "SUPER_ADMIN"
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(encodeSecret(secret));

    await expect(verifySessionToken(token, secret)).resolves.toBeNull();
  });

  it("rejects unexpected application claims instead of silently stripping them", async () => {
    const token = await new SignJWT({ ...validUser, isSuperuser: true })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(encodeSecret(secret));

    await expect(verifySessionToken(token, secret)).resolves.toBeNull();
  });

  it.each([
    ["blank user id", { id: " " }],
    ["blank name", { name: " " }],
    ["invalid email", { email: "not-an-email" }],
    ["blank organization id", { organizationId: " " }],
    ["blank membership id", { membershipId: " " }],
    ["zero session version", { sessionVersion: 0 }],
    ["negative session version", { sessionVersion: -1 }],
    ["fractional session version", { sessionVersion: 1.5 }]
  ])("rejects %s", async (_label, claims) => {
    const token = await new SignJWT({ ...validUser, ...claims })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(encodeSecret(secret));

    await expect(verifySessionToken(token, secret)).resolves.toBeNull();
  });

  it("rejects signed tokens using a non-HS256 algorithm", async () => {
    const token = await new SignJWT(validUser)
      .setProtectedHeader({ alg: "HS512" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(encodeSecret(secret));

    await expect(verifySessionToken(token, secret)).resolves.toBeNull();
  });

  it("rejects expired signed tokens", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT(validUser)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt(now - 120)
      .setExpirationTime(now - 60)
      .sign(encodeSecret(secret));

    await expect(verifySessionToken(token, secret)).resolves.toBeNull();
  });

  it("rejects tokens older than the maximum session age even when unexpired", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT(validUser)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt(now - 9 * 60 * 60)
      .setExpirationTime(now + 60 * 60)
      .sign(encodeSecret(secret));

    await expect(verifySessionToken(token, secret)).resolves.toBeNull();
  });

  it("rejects tokens with a future issued-at claim", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT(validUser)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt(now + 60 * 60)
      .setExpirationTime(now + 2 * 60 * 60)
      .sign(encodeSecret(secret));

    await expect(verifySessionToken(token, secret)).resolves.toBeNull();
  });

  it("rejects tokens without the expected issuer or audience", async () => {
    const now = Math.floor(Date.now() / 1000);
    const cases = [
      new SignJWT(validUser)
        .setProtectedHeader({ alg: "HS256" })
        .setAudience(audience),
      new SignJWT(validUser)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuer("other-app")
        .setAudience(audience),
      new SignJWT(validUser)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuer(issuer),
      new SignJWT(validUser)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuer(issuer)
        .setAudience("other-session")
    ];

    const tokens = await Promise.all(
      cases.map((jwt) =>
        jwt
          .setIssuedAt(now)
          .setExpirationTime(now + 60 * 60)
          .sign(encodeSecret(secret))
      )
    );

    await Promise.all(
      tokens.map((token) =>
        expect(verifySessionToken(token, secret)).resolves.toBeNull()
      )
    );
  });

  it("rejects malformed users before signing a session token", async () => {
    const malformedUser = {
      ...validUser,
      email: "not-an-email",
      role: "SUPER_ADMIN"
    };

    await expect(
      signSession(malformedUser as unknown as SessionUser, secret)
    ).rejects.toThrow();
  });
});
