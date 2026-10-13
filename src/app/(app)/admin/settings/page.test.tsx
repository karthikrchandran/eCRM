import { describe, expect, it, vi } from "vitest";
import AdminSettingsPage from "./page";

const { notFoundMock } = vi.hoisted(() => ({ notFoundMock: vi.fn(() => { throw new Error("NOT_FOUND"); }) }));

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

vi.mock("@/components/settings/business-settings-form", () => ({
  BusinessSettingsForm: () => <div>business settings</div>
}));

vi.mock("@/components/settings/cell-administration-panel", () => ({
  CellAdministrationPanel: vi.fn(() => <div>cell administration</div>)
}));

vi.mock("@/components/settings/integration-delivery-panel", () => ({
  IntegrationDeliveryPanel: vi.fn(() => <div>integration delivery</div>)
}));

vi.mock("@/components/ui/sales-primitives", () => ({
  PageHeader: () => <div>settings header</div>
}));

vi.mock("@/server/auth/current-user", () => ({
  requireUser: vi.fn()
}));

vi.mock("@/server/cell-admin/runtime", () => ({
  getCellAdministrationService: vi.fn(() => ({
    getConfiguration: vi.fn(),
    listUsers: vi.fn()
  }))
}));

vi.mock("@/server/cell-admin/module-access", () => ({
  getEnabledCellModules: vi.fn()
}));

vi.mock("@/server/env", () => ({
  getServerEnv: vi.fn()
}));

vi.mock("@/server/integration-delivery/runtime", () => ({
  getIntegrationCredentialService: vi.fn(),
  getIntegrationDeliveryRepository: vi.fn()
}));

vi.mock("@/server/settings/settings", () => ({
  getBusinessSettings: vi.fn().mockResolvedValue({ defaultCurrency: "INR" })
}));

describe("AdminSettingsPage", () => {
  it("renders business settings for an Admin when local runtime is platform mode", async () => {
    const user = {
      id: "user_admin",
      name: "Admin",
      email: "admin@example.com",
      role: "ADMIN" as const,
      active: true,
      organizationId: "org_test",
      membershipId: "membership_test",
      sessionVersion: 1
    };
    const { requireUser } = await import("@/server/auth/current-user");
    const { getServerEnv } = await import("@/server/env");
    const { getBusinessSettings } = await import("@/server/settings/settings");
    const { CellAdministrationPanel } = await import("@/components/settings/cell-administration-panel");

    vi.mocked(requireUser).mockResolvedValue(user);
    vi.mocked(getServerEnv).mockReturnValue({
      runtime: { mode: "platform" },
      CONTROL_PLANE_DATABASE_URL: "postgresql://control",
      TENANT_DATABASE_URL: "postgresql://tenant",
      AUTH_SECRET: "x".repeat(32),
      APP_BASE_URL: "http://localhost:3000",
      AUTH_MODE: "local-test",
      OIDC_SCOPES: "openid profile email"
    });

    await AdminSettingsPage();

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(getBusinessSettings).toHaveBeenCalledWith(user);
    expect(CellAdministrationPanel).not.toHaveBeenCalled();
  });
});
