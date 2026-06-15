import { describe, expect, it } from "vitest";
import {
  canApproveIncentives,
  canFinalizeCosts,
  canManageAdminSettings,
  canViewCompanyRecords
} from "./permissions";

describe("permissions", () => {
  it("allows both roles to view company records", () => {
    expect(canViewCompanyRecords("ADMIN")).toBe(true);
    expect(canViewCompanyRecords("SALES")).toBe(true);
  });

  it("limits admin settings, cost finalization, and incentive approval to Admin", () => {
    expect(canManageAdminSettings("ADMIN")).toBe(true);
    expect(canFinalizeCosts("ADMIN")).toBe(true);
    expect(canApproveIncentives("ADMIN")).toBe(true);

    expect(canManageAdminSettings("SALES")).toBe(false);
    expect(canFinalizeCosts("SALES")).toBe(false);
    expect(canApproveIncentives("SALES")).toBe(false);
  });
});
