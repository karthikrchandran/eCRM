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

  it("presents eCRM context with a real ARA visual and the sign-in form", () => {
    render(<LoginLanding />);

    expect(screen.getByRole("heading", { name: /Lead-to-cash workspace/ })).toBeVisible();
    expect(screen.getByText(/Track leads, proposals, booked orders, production stages/)).toBeVisible();
    expect(screen.getByRole("img", { name: /ARA Global safety training/ })).toHaveAttribute(
      "src",
      expect.stringContaining("araglobalinc.com")
    );
    expect(screen.getByRole("button", { name: "Sign in" })).toBeVisible();
  });
});
