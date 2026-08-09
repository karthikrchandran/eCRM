import { describe, expect, it, vi } from "vitest";
import { authenticateLogin } from "./login";

const activeUser = {
  id: "user_1",
  name: "Admin User",
  email: "admin@example.com",
  passwordHash: "hashed-password",
  role: "ADMIN" as const,
  active: true,
  memberships: [
    {
      id: "membership_1",
      organizationId: "org_1",
      role: "OWNER" as const,
      status: "ACTIVE" as const,
      updatedAt: new Date("2026-08-09T12:00:00.000Z"),
      organization: { status: "ACTIVE" as const }
    }
  ]
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
        organizationId: "org_1",
        membershipId: "membership_1",
        role: "OWNER",
        sessionVersion: new Date("2026-08-09T12:00:00.000Z").getTime()
      }
    });
  });

  it("rejects a valid password when there is no active membership in an active organization", async () => {
    const result = await authenticateLogin(
      { email: "admin@example.com", password: "Admin@12345" },
      {
        findUserByEmail: vi.fn().mockResolvedValue({ ...activeUser, memberships: [] }),
        verifyPassword: vi.fn().mockResolvedValue(true)
      }
    );

    expect(result).toEqual({ error: "Invalid email or password." });
  });

  it.each([
    ["INVITED membership", { status: "INVITED", organization: { status: "ACTIVE" } }],
    ["SUSPENDED membership", { status: "SUSPENDED", organization: { status: "ACTIVE" } }],
    ["REVOKED membership", { status: "REVOKED", organization: { status: "ACTIVE" } }],
    ["PROVISIONING organization", { status: "ACTIVE", organization: { status: "PROVISIONING" } }],
    ["SUSPENDED organization", { status: "ACTIVE", organization: { status: "SUSPENDED" } }],
    ["OFFBOARDING organization", { status: "ACTIVE", organization: { status: "OFFBOARDING" } }],
    ["DELETED organization", { status: "ACTIVE", organization: { status: "DELETED" } }]
  ])("rejects a valid password with %s", async (_label, membershipOverrides) => {
    const membership = {
      ...activeUser.memberships[0],
      ...membershipOverrides
    };
    const result = await authenticateLogin(
      { email: "admin@example.com", password: "Admin@12345" },
      {
        findUserByEmail: vi.fn().mockResolvedValue({ ...activeUser, memberships: [membership] }),
        verifyPassword: vi.fn().mockResolvedValue(true)
      }
    );

    expect(result).toEqual({ error: "Invalid email or password." });
  });

  it("selects the most recently updated active membership and uses its database role", async () => {
    const result = await authenticateLogin(
      { email: "admin@example.com", password: "Admin@12345" },
      {
        findUserByEmail: vi.fn().mockResolvedValue({
          ...activeUser,
          role: "ADMIN",
          memberships: [
            {
              ...activeUser.memberships[0],
              id: "membership_older",
              organizationId: "org_older",
              role: "ADMIN",
              updatedAt: new Date("2026-08-08T12:00:00.000Z")
            },
            {
              ...activeUser.memberships[0],
              id: "membership_newer",
              organizationId: "org_newer",
              role: "FINANCE",
              updatedAt: new Date("2026-08-09T12:00:00.000Z")
            }
          ]
        }),
        verifyPassword: vi.fn().mockResolvedValue(true)
      }
    );

    expect(result).toMatchObject({
      user: {
        organizationId: "org_newer",
        membershipId: "membership_newer",
        role: "FINANCE",
        sessionVersion: new Date("2026-08-09T12:00:00.000Z").getTime()
      }
    });
  });

  it("breaks equal membership timestamps by membership id ascending", async () => {
    const result = await authenticateLogin(
      { email: "admin@example.com", password: "Admin@12345" },
      {
        findUserByEmail: vi.fn().mockResolvedValue({
          ...activeUser,
          memberships: [
            { ...activeUser.memberships[0], id: "membership_z", organizationId: "org_z" },
            { ...activeUser.memberships[0], id: "membership_a", organizationId: "org_a", role: "SALES" }
          ]
        }),
        verifyPassword: vi.fn().mockResolvedValue(true)
      }
    );

    expect(result).toMatchObject({
      user: { organizationId: "org_a", membershipId: "membership_a", role: "SALES" }
    });
  });
});
