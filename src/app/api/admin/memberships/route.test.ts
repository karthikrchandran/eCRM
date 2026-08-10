import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH, POST } from "./route";
import { getControlPlaneDb } from "@/server/db";
import { getCurrentOrganizationContext } from "@/server/organizations/context";

vi.mock("@/server/db", () => ({ getControlPlaneDb: vi.fn() }));
vi.mock("@/server/organizations/context", () => ({ getCurrentOrganizationContext: vi.fn() }));

const db = {
  organizationMembership: {
    findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn()
  },
  user: { upsert: vi.fn() }
};
const contextMock = vi.mocked(getCurrentOrganizationContext);

describe("admin memberships routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getControlPlaneDb).mockReturnValue(db as never);
    contextMock.mockResolvedValue({ userId: "actor", name: "Owner", email: "owner@example.com", organizationId: "org_a", membershipId: "m_actor", role: "OWNER", sessionVersion: 1 });
    db.organizationMembership.findMany.mockResolvedValue([{ id: "m_a", organizationId: "org_a", role: "SALES", status: "ACTIVE", user: { id: "u_a", name: "Ada", email: "ada@example.com", active: true } }]);
    db.organizationMembership.findFirst.mockResolvedValue({ id: "m_a", organizationId: "org_a", role: "SALES", status: "INVITED", user: { id: "u_a", name: "Ada", email: "ada@example.com", active: true } });
    db.organizationMembership.update.mockResolvedValue({ id: "m_a", organizationId: "org_a", role: "SALES", status: "ACTIVE", user: { id: "u_a", name: "Ada", email: "ada@example.com", active: true } });
    db.user.upsert.mockResolvedValue({ id: "u_new", name: "New User", email: "new@example.com", active: true });
    db.organizationMembership.create.mockResolvedValue({ id: "m_new", organizationId: "org_a", role: "SALES", status: "INVITED", user: { id: "u_new", name: "New User", email: "new@example.com", active: true } });
  });

  it("lists only memberships in the current organization for an owner", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(db.organizationMembership.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org_a" } }));
  });

  it("allows an admin to invite a member and starts it as INVITED", async () => {
    contextMock.mockResolvedValueOnce({ userId: "actor", name: "Admin", email: "admin@example.com", organizationId: "org_a", membershipId: "m_actor", role: "ADMIN", sessionVersion: 1 });
    db.organizationMembership.findFirst.mockResolvedValueOnce(null);
    const response = await POST(new Request("http://localhost/api/admin/memberships", { method: "POST", body: JSON.stringify({ email: "new@example.com", name: "New User", role: "SALES" }) }));
    expect(response.status).toBe(201);
    expect(db.organizationMembership.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: "org_a", status: "INVITED" }) }));
  });

  it("activates or revokes a membership only when it belongs to the current organization", async () => {
    const response = await PATCH(new Request("http://localhost/api/admin/memberships", { method: "PATCH", body: JSON.stringify({ membershipId: "m_a", status: "ACTIVE" }) }));
    expect(response.status).toBe(200);
    expect(db.organizationMembership.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "m_a", organizationId: "org_a" } }));
    expect(db.organizationMembership.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "m_a" }, data: { status: "ACTIVE" } }));
  });

  it("denies sales and cross-organization membership ids", async () => {
    contextMock.mockResolvedValueOnce({ userId: "sales", name: "Sales", email: "sales@example.com", organizationId: "org_a", membershipId: "m_sales", role: "SALES", sessionVersion: 1 });
    expect((await GET()).status).toBe(403);
    contextMock.mockResolvedValueOnce({ userId: "actor", name: "Owner", email: "owner@example.com", organizationId: "org_a", membershipId: "m_actor", role: "OWNER", sessionVersion: 1 });
    db.organizationMembership.findFirst.mockResolvedValueOnce(null);
    expect((await PATCH(new Request("http://localhost/api/admin/memberships", { method: "PATCH", body: JSON.stringify({ membershipId: "m_other", status: "REVOKED" }) }))).status).toBe(404);
    expect(db.organizationMembership.update).not.toHaveBeenCalled();
  });
});
