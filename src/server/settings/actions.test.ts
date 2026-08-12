import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerEnv: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
  updateBusinessSettings: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/server/auth/current-user", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/server/env", () => ({ getServerEnv: mocks.getServerEnv }));
vi.mock("./settings", () => ({ updateBusinessSettings: mocks.updateBusinessSettings }));

import { updateBusinessSettingsAction } from "./actions";

describe("business settings action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerEnv.mockReturnValue({ runtime: { mode: "cell", cellId: "cell_1", cellKey: "acme" } });
    mocks.requireUser.mockResolvedValue({ id: "admin_1", role: "ADMIN" });
    mocks.updateBusinessSettings.mockResolvedValue({ defaultCurrency: "USD" });
  });

  it("is hidden in platform mode before resolving a local session", async () => {
    mocks.getServerEnv.mockReturnValue({ runtime: { mode: "platform" } });
    const formData = new FormData();
    formData.set("defaultCurrency", "USD");

    await expect(updateBusinessSettingsAction({ ok: false }, formData)).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.requireUser).not.toHaveBeenCalled();
    expect(mocks.updateBusinessSettings).not.toHaveBeenCalled();
  });

  it("passes the authenticated local Admin and complete audit context to the service", async () => {
    const formData = new FormData();
    formData.set("defaultCurrency", "USD");

    await expect(updateBusinessSettingsAction({ ok: false }, formData)).resolves.toEqual({
      ok: true,
      message: "Business settings saved."
    });

    expect(mocks.updateBusinessSettings).toHaveBeenCalledWith(
      { id: "admin_1", role: "ADMIN" },
      { defaultCurrency: "USD" },
      {
        correlationId: expect.any(String),
        reason: "Customer administrator changed the default currency"
      }
    );
  });
});
