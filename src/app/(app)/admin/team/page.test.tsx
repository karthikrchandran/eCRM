import { describe, expect, it, vi } from "vitest";
import TeamPage from "./page";

const { notFoundMock } = vi.hoisted(() => ({ notFoundMock: vi.fn(() => { throw new Error("NOT_FOUND"); }) }));
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));
vi.mock("@/server/auth/current-user", () => ({ requireUser: vi.fn() }));
vi.mock("@/server/db", () => ({ getControlPlaneDb: vi.fn() }));
vi.mock("@/components/admin/team-members", () => ({ TeamMembers: () => <div>team members</div> }));

describe("TeamPage", () => {
  it("fails closed for non-admin users", async () => {
    const { requireUser } = await import("@/server/auth/current-user");
    vi.mocked(requireUser).mockResolvedValue({ id: "u", name: "Sales", email: "sales@example.com", role: "SALES", active: true, organizationId: "org", membershipId: "m", sessionVersion: 1 });
    await expect(TeamPage()).rejects.toThrow("NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });
});
