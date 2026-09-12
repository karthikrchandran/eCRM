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

  it("presents neutral eCRM branding without assuming a customer identity", () => {
    render(<LoginLanding />);

    expect(screen.getByRole("heading", { name: /Lead-to-cash workspace/ })).toBeVisible();
    expect(screen.getByText(/Track leads, proposals, booked orders, production stages/)).toBeVisible();
    expect(screen.queryByText(/ARA Global/i)).not.toBeInTheDocument();
    expect(screen.getByText("Secure customer-cell workspace")).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeVisible();
  });
});
