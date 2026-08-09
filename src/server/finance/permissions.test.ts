import { describe, expect, test } from "vitest";
import { assertCanManageFinance, assertCanViewFinance } from "./permissions";

describe("finance permissions", () => {
  test("allows Admin and Sales to view finance status", () => {
    expect(() => assertCanViewFinance({ id: "admin", organizationId: "org_test", role: "ADMIN" })).not.toThrow();
    expect(() => assertCanViewFinance({ id: "sales", organizationId: "org_test", role: "SALES" })).not.toThrow();
  });

  test("restricts finance writes to Admin users", () => {
    expect(() => assertCanManageFinance({ id: "admin", organizationId: "org_test", role: "ADMIN" })).not.toThrow();
    expect(() => assertCanManageFinance({ id: "sales", organizationId: "org_test", role: "SALES" })).toThrow("manage finance");
  });
});
