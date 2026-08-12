import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CellAdministrationPanel } from "./cell-administration-panel";

describe("CellAdministrationPanel", () => {
  it("progressively exposes branding/modules before local user management", () => {
    render(
      <CellAdministrationPanel
        configuration={{
          id: "default",
          displayName: "eCRM",
          logoUrl: null,
          supportUrl: null,
          legalUrl: null,
          primaryColor: "#1e3a5f",
          locale: "en-US",
          timezone: "UTC",
          defaultCurrency: "INR",
          enabledModules: ["crm"],
          allowedModules: ["crm", "finance"],
          planCode: "ENTERPRISE",
          revision: 1,
          createdAt: new Date("2026-08-11T12:00:00Z"),
          updatedAt: new Date("2026-08-11T12:00:00Z")
        }}
        users={[{ id: "admin_1", name: "Admin", email: "admin@example.com", role: "ADMIN", active: true }]}
      />
    );

    expect(screen.getByRole("heading", { name: "Workspace identity and modules" })).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Finance" })).not.toBeChecked();
    expect(screen.getByText("Plan: ENTERPRISE")).toBeVisible();
    expect(screen.getByText(/admin@example.com · Admin role/)).toBeInTheDocument();
    expect(screen.getByText("Add or change local users")).toBeVisible();
  });

  it("shows excluded modules as plan-limited instead of configurable toggles", () => {
    render(<CellAdministrationPanel configuration={{
      id: "default",
      displayName: "Acme",
      logoUrl: null,
      supportUrl: null,
      legalUrl: null,
      primaryColor: "#1e3a5f",
      locale: "en-US",
      timezone: "UTC",
      defaultCurrency: "INR",
      enabledModules: ["crm"],
      allowedModules: ["crm", "reports"],
      planCode: "GROWTH",
      revision: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }} users={[]} />);

    expect(screen.getByRole("checkbox", { name: "CRM" })).toBeEnabled();
    expect(screen.getByText("Finance - Plan-limited")).toBeVisible();
    expect(screen.queryByRole("checkbox", { name: "Finance" })).not.toBeInTheDocument();
  });
});
