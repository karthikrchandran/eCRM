import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

vi.mock("@/server/auth/actions", () => ({
  logoutAction: vi.fn()
}));

const pathnameMock = vi.hoisted(() => vi.fn<() => string | null>(() => null));
vi.mock("next/navigation", () => ({
  usePathname: pathnameMock
}));

describe("AppShell", () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue(null);
  });

  it("renders the signed-in identity and role once in the sidebar", () => {
    render(
      <AppShell user={{ name: "Kavya Iyer", email: "admin@example.com", role: "ADMIN" }}>
        <p>Dashboard content</p>
      </AppShell>
    );

    expect(screen.getAllByText("Kavya Iyer")).toHaveLength(1);
    expect(screen.getAllByText("admin@example.com")).toHaveLength(1);
    expect(screen.getAllByText("Admin")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();
  });

  it("uses the same sidebar layout for both roles", () => {
    const { rerender } = render(
      <AppShell user={{ name: "Kavya Iyer", email: "admin@example.com", role: "ADMIN" }}>
        <p>Dashboard content</p>
      </AppShell>
    );

    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeVisible();

    rerender(
      <AppShell user={{ name: "Priya Menon", email: "sales@example.com", role: "SALES" }}>
        <p>Dashboard content</p>
      </AppShell>
    );

    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
    expect(screen.getByText("Lead-to-cash workspace")).toBeVisible();
  });

  it("marks the current route and its sub-routes as the active page", () => {
    pathnameMock.mockReturnValue("/opportunities/abc123");
    render(
      <AppShell user={{ name: "Priya Menon", email: "sales@example.com", role: "SALES" }}>
        <p>Dashboard content</p>
      </AppShell>
    );

    expect(screen.getByRole("link", { name: "Pipeline" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Leads" })).not.toHaveAttribute("aria-current");
  });

  it("does not treat a sibling route with a shared prefix as active", () => {
    pathnameMock.mockReturnValue("/admin/performance");
    render(
      <AppShell user={{ name: "Kavya Iyer", email: "admin@example.com", role: "ADMIN" }}>
        <p>Dashboard content</p>
      </AppShell>
    );

    expect(screen.getByRole("link", { name: "Team performance" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Settings" })).not.toHaveAttribute("aria-current");
  });

  it("toggles the mobile navigation menu", () => {
    render(
      <AppShell user={{ name: "Priya Menon", email: "sales@example.com", role: "SALES" }}>
        <p>Dashboard content</p>
      </AppShell>
    );

    const toggle = screen.getByRole("button", { name: "Open navigation" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Close navigation" })).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("link", { name: "Leads" }));
    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
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

    expect(screen.getByText("Admin Console")).toBeVisible();
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

  it("hides navigation for disabled customer-cell modules", () => {
    render(
      <AppShell enabledModules={["crm", "reports"]} user={{ name: "Kavya Iyer", email: "admin@example.com", role: "ADMIN" }}>
        <p>Dashboard content</p>
      </AppShell>
    );

    expect(screen.getByRole("link", { name: "Pipeline" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Reports" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Orders" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Finance" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Production" })).not.toBeInTheDocument();
  });
});
