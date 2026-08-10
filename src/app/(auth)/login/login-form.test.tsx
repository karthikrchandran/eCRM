import { render, screen } from "@testing-library/react";
import { useActionState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

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

describe("LoginForm", () => {
  beforeEach(() => {
    vi.mocked(useActionState).mockReturnValue([
      { error: "Invalid email or password." },
      vi.fn(),
      false
    ]);
  });

  it("announces visible login errors to assistive technology", () => {
    render(<LoginForm />);

    const error = screen.getByRole("alert");

    expect(error).toHaveTextContent("Invalid email or password.");
    expect(error).toHaveAttribute("id", "login-error");
    expect(screen.getByRole("button", { name: "Sign in" })).toHaveAccessibleDescription(
      "Invalid email or password."
    );
  });

  it("presents neutral CommitArc sign-in guidance without legacy product copy", () => {
    render(<LoginForm />);

    expect(screen.getByRole("heading", { level: 2, name: "Welcome back" })).toBeVisible();
    expect(screen.getByText("Sign in to continue.")).toBeVisible();
    expect(screen.queryByText(/ARA|eCRM|SignalLoop/i)).not.toBeInTheDocument();
  });

  it("offers centralized identity only when enabled", () => {
    render(<LoginForm oidcEnabled />);

    expect(screen.getByRole("link", { name: "Continue with company identity" })).toHaveAttribute(
      "href",
      "/api/auth/oidc/start"
    );
  });
});
