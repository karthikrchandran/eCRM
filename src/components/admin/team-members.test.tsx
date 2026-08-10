import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TeamMembers } from "./team-members";

type TestMembership = React.ComponentProps<typeof TeamMembers>["initialMembers"][number];

const members: TestMembership[] = [
  {
    id: "m-1",
    role: "ADMIN",
    status: "ACTIVE",
    user: { id: "u-1", name: "Asha Rao", email: "asha@example.com", active: true }
  },
  {
    id: "m-2",
    role: "SALES",
    status: "SUSPENDED",
    user: { id: "u-2", name: "Ben Singh", email: "ben@example.com", active: true }
  }
];

describe("TeamMembers", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("lists members and exposes suspend and activate controls", () => {
    render(<TeamMembers initialMembers={members} currentMembershipId="m-owner" />);

    expect(screen.getByText("Asha Rao")).toBeVisible();
    expect(screen.getByText("asha@example.com")).toBeVisible();
    expect(screen.getByRole("button", { name: "Suspend Asha Rao" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Activate Ben Singh" })).toBeVisible();
  });

  it("submits an invitation and refreshes the member list", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (init?.method === "POST") {
        expect(input).toBe("/api/admin/memberships");
        expect(JSON.parse(String(init.body))).toMatchObject({ email: "new@example.com", name: "New User", role: "FINANCE" });
        return new Response(JSON.stringify({ membership: { id: "m-3", role: "FINANCE", status: "INVITED", user: { id: "u-3", name: "New User", email: "new@example.com", active: true } } }), { status: 201 });
      }
      return new Response(JSON.stringify({ memberships: [...members, { id: "m-3", role: "FINANCE", status: "INVITED", user: { id: "u-3", name: "New User", email: "new@example.com", active: true } }] }));
    });

    render(<TeamMembers initialMembers={members} currentMembershipId="m-1" />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New User" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "FINANCE" } });
    fireEvent.click(screen.getByRole("button", { name: "Invite member" }));

    await waitFor(() => expect(screen.getByText("Invitation sent to new@example.com")).toBeVisible());
    expect(fetchMock).toHaveBeenCalled();
  });

  it("fails closed when rendered without admin capability", () => {
    render(<TeamMembers initialMembers={members} currentMembershipId="m-1" canManage={false} />);
    expect(screen.getByText("Organization administrator access required.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Invite member" })).not.toBeInTheDocument();
  });
});
