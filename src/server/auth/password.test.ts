import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password utilities", () => {
  it("verifies the original password against its hash", async () => {
    const hash = await hashPassword("Admin@12345");

    await expect(verifyPassword("Admin@12345", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("Admin@12345");

    await expect(verifyPassword("WrongPassword", hash)).resolves.toBe(false);
  });
});
