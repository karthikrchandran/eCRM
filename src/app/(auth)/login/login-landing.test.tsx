import { render, screen } from "@testing-library/react";
import { useActionState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginLanding } from "./login-landing";

vi.mock("@/server/auth/actions", () => ({
  loginAction: vi.fn()
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useActionState: vi.fn()
  };
});

describe("LoginLanding", () => {
  beforeEach(() => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), false]);
  });

  it("presents the CommitArc operating view and sign-in form without legacy branding", () => {
    render(<LoginLanding />);

    expect(screen.getByText("CommitArc")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Turn every customer commitment into coordinated action." })
    ).toBeVisible();
    expect(
      screen.getByText(
        "Bring conversations, commercial decisions, delivery, and collections into one shared operating view."
      )
    ).toBeVisible();
    expect(screen.getByText("Build momentum")).toBeVisible();
    expect(screen.getByText("Keep opportunities, decisions, and next actions moving.")).toBeVisible();
    expect(screen.getByText("Deliver with clarity")).toBeVisible();
    expect(screen.getByText("Coordinate commitments, owners, milestones, and due dates.")).toBeVisible();
    expect(screen.getByText("See the whole picture")).toBeVisible();
    expect(screen.getByText("Connect commercial progress, delivery, and cash in one view.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeVisible();
    expect(screen.queryByText(/ARA Global|eCRM|SignalLoop/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
