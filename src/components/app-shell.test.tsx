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

  it("shows production config navigation only for admins", () => {
    const { rerender } = render(
      <AppShell user={{ name: "Kavya Iyer", email: "admin@example.com", role: "ADMIN" }}>
        <p>Dashboard content</p>
      </AppShell>
    );

    expect(screen.getByRole("link", { name: "Production config" })).toHaveAttribute("href", "/admin/production-config");

    rerender(
      <AppShell user={{ name: "Priya Menon", email: "sales@example.com", role: "SALES" }}>
        <p>Dashboard content</p>
      </AppShell>
    );

    expect(screen.queryByRole("link", { name: "Production config" })).not.toBeInTheDocument();
  });

  it("shows Customer 360 as a launchable workspace for sales and admin users", () => {
    const { rerender } = render(
      <AppShell user={{ name: "Kavya Iyer", email: "admin@example.com", role: "ADMIN" }}>
        <p>Dashboard content</p>
      </AppShell>
    );

    expect(screen.getByRole("link", { name: "Customer 360" })).toHaveAttribute("href", "/customer-360");

    rerender(
      <AppShell user={{ name: "Priya Menon", email: "sales@example.com", role: "SALES" }}>
        <p>Dashboard content</p>
      </AppShell>
    );

    expect(screen.getByRole("link", { name: "Customer 360" })).toHaveAttribute("href", "/customer-360");
  });
});
