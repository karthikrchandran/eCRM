import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

vi.mock("@/server/auth/actions", () => ({
  logoutAction: vi.fn()
}));

describe("AppShell", () => {
  it("renders the signed-in identity and role in mobile and desktop header regions", () => {
    render(
      <AppShell user={{ name: "Kavya Iyer", email: "admin@example.com", role: "ADMIN" }}>
        <p>Dashboard content</p>
      </AppShell>
    );

    expect(screen.getAllByText("Kavya Iyer")).toHaveLength(2);
    expect(screen.getAllByText("admin@example.com")).toHaveLength(2);
    expect(screen.getAllByText("Admin")).toHaveLength(2);
  });
});
