import { describe, expect, it, vi } from "vitest";

import { createLocalUserCollectionHandlers } from "./route";

const authorized = { user: { id: "admin_1", role: "ADMIN" as const }, cellId: "cell_ara", cellKey: "ara-global" };

describe("local user administration API", () => {
  it("creates a local Sales user and returns 201", async () => {
    const createUser = vi.fn().mockResolvedValue({ id: "sales_1", email: "sales@example.com", role: "SALES", active: true });
    const handlers = createLocalUserCollectionHandlers({ authorize: vi.fn().mockResolvedValue(authorized), listUsers: vi.fn(), createUser });
    const response = await handlers.POST(new Request("http://localhost/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Sales User",
        email: "sales@example.com",
        password: "SecurePassphrase123!",
        role: "SALES",
        correlationId: "corr_2",
        reason: "New employee"
      })
    }));
    expect(response.status).toBe(201);
  });

  it("returns 400 for an invalid role or weak password", async () => {
    const createUser = vi.fn();
    const handlers = createLocalUserCollectionHandlers({ authorize: vi.fn().mockResolvedValue(authorized), listUsers: vi.fn(), createUser });
    const response = await handlers.POST(new Request("http://localhost/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "User", email: "user@example.com", password: "short", role: "OWNER", correlationId: "c", reason: "r" })
    }));
    expect(response.status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });
});
