// @vitest-environment node

import { describe, expect, it } from "vitest";
import { signSession, verifySessionToken } from "./session";

const secret = "12345678901234567890123456789012";

describe("session utilities", () => {
  it("round-trips a signed session token", async () => {
    const token = await signSession(
      {
        id: "user_1",
        email: "admin@example.com",
        name: "Admin User",
        role: "ADMIN"
      },
      secret
    );

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
});
