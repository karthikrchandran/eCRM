import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({
  getControlPlaneDb: vi.fn(() => ({
    organizationInstallation: { findUnique: vi.fn() },
    $transaction: vi.fn()
  }))
}));

vi.mock("@/server/integrations/installation-projection", () => ({
  verifyInstallationProjection: vi.fn()
}));

describe("installation projection route", () => {
  it("exports a POST receiver", async () => {
    const route = await import("./route");
    expect(typeof route.POST).toBe("function");
  });
});
