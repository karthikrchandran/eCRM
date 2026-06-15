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
});
