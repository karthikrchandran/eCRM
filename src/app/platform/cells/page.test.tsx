import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }) }));
vi.mock("@/server/env", () => ({ getServerEnv: vi.fn() }));
vi.mock("@/components/platform/customer-cell-onboarding-panel", () => ({ CustomerCellOnboardingPanel: () => <div>onboarding</div> }));

import { getServerEnv } from "@/server/env";
import PlatformCellsPage from "./page";

describe("PlatformCellsPage", () => {
  it("fails closed outside platform runtime", () => {
    vi.mocked(getServerEnv).mockReturnValue({ runtime: { mode: "cell", cellId: "cell_ara", cellKey: "ara-global" }, DATABASE_URL: "db", AUTH_SECRET: "x".repeat(32), APP_BASE_URL: "http://localhost:3000" });
    expect(() => PlatformCellsPage()).toThrow("NOT_FOUND");
  });

  it("renders onboarding in platform runtime", () => {
    vi.mocked(getServerEnv).mockReturnValue({ runtime: { mode: "platform" }, DATABASE_URL: "db", AUTH_SECRET: "x".repeat(32), APP_BASE_URL: "http://localhost:3000" });
    expect(PlatformCellsPage()).toBeTruthy();
  });
});
