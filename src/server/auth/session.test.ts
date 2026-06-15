// @vitest-environment node

import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { signSession, verifySessionToken, type SessionUser } from "./session";

const secret = "12345678901234567890123456789012";
const otherSecret = "abcdefghijklmnopqrstuvwxzy123456";
const issuer = "ecrm";
const audience = "ecrm-session";

const validUser: SessionUser = {
  id: "user_1",
  email: "admin@example.com",
  name: "Admin User",
  role: "ADMIN"
};

function encodeSecret(value: string) {
  return new TextEncoder().encode(value);
}

describe("session utilities", () => {
  it("round-trips a signed session token", async () => {
    const token = await signSession(validUser, secret);

    await expect(verifySessionToken(token, secret)).resolves.toMatchObject({
      id: "user_1",
      email: "admin@example.com",
      name: "Admin User",
      role: "ADMIN"
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

  it("rejects signed tokens with invalid user claim schema", async () => {
    const token = await new SignJWT({
      ...validUser,
      email: "not-an-email",
      role: "OWNER"
    })
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
      role: "OWNER"
    };

    await expect(
      signSession(malformedUser as unknown as SessionUser, secret)
    ).rejects.toThrow();
  });
});
