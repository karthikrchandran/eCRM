import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

const BCRYPT_TEST_TIMEOUT_MS = 15_000;

describe("password utilities", () => {
  it("verifies the original password against its hash", async () => {
    const hash = await hashPassword("Admin@12345");

    await expect(verifyPassword("Admin@12345", hash)).resolves.toBe(true);
  }, BCRYPT_TEST_TIMEOUT_MS);

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("Admin@12345");

    await expect(verifyPassword("WrongPassword", hash)).resolves.toBe(false);
  }, BCRYPT_TEST_TIMEOUT_MS);
});
