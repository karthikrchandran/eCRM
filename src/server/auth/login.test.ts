import { describe, expect, it, vi } from "vitest";
import { authenticateLogin } from "./login";

const activeUser = {
  id: "user_1",
  name: "Admin User",
  email: "admin@example.com",
  passwordHash: "hashed-password",
  role: "ADMIN" as const,
  active: true
};

describe("authenticateLogin", () => {
  it("rejects an invalid email address", async () => {
    const result = await authenticateLogin({
      email: "not-an-email",
      password: "Admin@12345"
    });

    expect(result).toEqual({ error: "Enter a valid email address." });
  });

  it("rejects an empty password", async () => {
    const result = await authenticateLogin({
      email: "admin@example.com",
      password: ""
    });

    expect(result).toEqual({ error: "Enter your password." });
  });

  it("looks up users by normalized email", async () => {
    const findUserByEmail = vi.fn().mockResolvedValue(activeUser);
    const verifyPassword = vi.fn().mockResolvedValue(true);

    await authenticateLogin(
      {
        email: "Admin@Example.COM",
        password: "Admin@12345"
      },
      { findUserByEmail, verifyPassword }
    );

    expect(findUserByEmail).toHaveBeenCalledWith("admin@example.com");
  });

  it("rejects inactive users with the safe login error", async () => {
    const findUserByEmail = vi.fn().mockResolvedValue({
      ...activeUser,
      active: false
    });
    const verifyPassword = vi.fn().mockResolvedValue(true);

    const result = await authenticateLogin(
      {
        email: "admin@example.com",
        password: "Admin@12345"
      },
      { findUserByEmail, verifyPassword }
    );

    expect(result).toEqual({ error: "Invalid email or password." });
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("rejects incorrect passwords with the safe login error", async () => {
    const result = await authenticateLogin(
      {
        email: "admin@example.com",
        password: "WrongPassword"
      },
      {
        findUserByEmail: vi.fn().mockResolvedValue(activeUser),
        verifyPassword: vi.fn().mockResolvedValue(false)
      }
    );

    expect(result).toEqual({ error: "Invalid email or password." });
  });

  it("returns the session user for active users with a valid password", async () => {
    const result = await authenticateLogin(
      {
        email: "admin@example.com",
        password: "Admin@12345"
      },
      {
        findUserByEmail: vi.fn().mockResolvedValue(activeUser),
        verifyPassword: vi.fn().mockResolvedValue(true)
      }
    );

    expect(result).toEqual({
      user: {
        id: "user_1",
        name: "Admin User",
        email: "admin@example.com",
        role: "ADMIN"
      }
    });
  });
});
