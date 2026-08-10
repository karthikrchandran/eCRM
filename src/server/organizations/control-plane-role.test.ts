import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(path.join(process.cwd(), "prisma/operations/configure-control-plane-role.sql"), "utf8");

describe("control-plane runtime role operation", () => {
  it("uses externally provisioned credentials and non-bypass roles", () => {
    expect(sql).toContain("NOLOGIN NOSUPERUSER");
    expect(sql).toContain("rolcanlogin");
    expect(sql).toContain("NOT rolbypassrls");
    expect(sql).not.toMatch(/PASSWORD\s+/i);
  });

  it("grants only control tables and asserts all business tables are inaccessible", () => {
    expect(sql).toContain('GRANT SELECT ON TABLE "User", "Organization", "OrganizationMembership"');
    expect(sql).toContain('GRANT SELECT, INSERT, UPDATE ON TABLE "BusinessSettings"');
    for (const table of ["LeadCustomer", "Opportunity", "Order", "Invoice", "WorkflowEvent"]) {
      expect(sql).toContain(`('${table}')`);
    }
    expect(sql).toContain("control_login_cannot_access_business_data");
  });
});
