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

  it("shows setup navigation only for admins", () => {
    const { rerender } = render(
      <AppShell user={{ name: "Kavya Iyer", email: "admin@example.com", role: "ADMIN" }}>
        <p>Dashboard content</p>
      </AppShell>
    );

    expect(screen.getByText("Setup")).toBeVisible();
    expect(screen.getByRole("link", { name: "Production" })).toHaveAttribute("href", "/production");
    expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute("href", "/admin/products");
    expect(screen.getByRole("link", { name: "Production config" })).toHaveAttribute("href", "/admin/production-config");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/admin/settings");

    rerender(
      <AppShell user={{ name: "Priya Menon", email: "sales@example.com", role: "SALES" }}>
        <p>Dashboard content</p>
      </AppShell>
    );

    expect(screen.queryByText("Setup")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Production config" })).not.toBeInTheDocument();
  });

  it("uses an admin console frame without personal sales links", () => {
    render(
      <AppShell user={{ name: "Kavya Iyer", email: "admin@example.com", role: "ADMIN" }}>
        <p>Dashboard content</p>
      </AppShell>
    );

    expect(screen.getByRole("banner")).toHaveTextContent("Admin Console");
    expect(screen.queryByRole("link", { name: "My Day" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Leads" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Contacts" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pipeline" })).toHaveAttribute("href", "/opportunities");
  });

  it("shows the team performance link for admins and hides it for sales users", () => {
    const { rerender } = render(
      <AppShell user={{ name: "Kavya Iyer", email: "admin@example.com", role: "ADMIN" }}>
        <p>Dashboard content</p>
      </AppShell>
    );

    expect(screen.getByRole("link", { name: "Team performance" })).toHaveAttribute("href", "/admin/performance");

    rerender(
      <AppShell user={{ name: "Priya Menon", email: "sales@example.com", role: "SALES" }}>
        <p>Dashboard content</p>
      </AppShell>
    );

    expect(screen.queryByRole("link", { name: "Team performance" })).not.toBeInTheDocument();
  });

  it("shows the sales performance link for sales users", () => {
    const { rerender } = render(
      <AppShell user={{ name: "Kavya Iyer", email: "admin@example.com", role: "ADMIN" }}>
        <p>Dashboard content</p>
      </AppShell>
    );

    expect(screen.getByRole("link", { name: "Orders" })).toHaveAttribute("href", "/orders");

    rerender(
      <AppShell user={{ name: "Priya Menon", email: "sales@example.com", role: "SALES" }}>
        <p>Dashboard content</p>
      </AppShell>
    );

    expect(screen.getByRole("link", { name: "Performance" })).toHaveAttribute("href", "/performance");
    expect(screen.queryByRole("link", { name: "Orders" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Production" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Leads" })).toHaveAttribute("href", "/leads");
    expect(screen.getByRole("link", { name: "Contacts" })).toHaveAttribute("href", "/contacts");
  });

  it("keeps the sales workspace navigation connected across leads, contacts, and pipeline", () => {
    render(
      <AppShell user={{ name: "Priya Menon", email: "sales@example.com", role: "SALES" }}>
        <p>Dashboard content</p>
      </AppShell>
    );

    expect(screen.getByRole("link", { name: "Leads" })).toHaveAttribute("href", "/leads");
    expect(screen.getByRole("link", { name: "Contacts" })).toHaveAttribute("href", "/contacts");
    expect(screen.getByRole("link", { name: "Pipeline" })).toHaveAttribute("href", "/opportunities");
  });
});
