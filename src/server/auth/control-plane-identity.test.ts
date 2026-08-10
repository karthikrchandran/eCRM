import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("control-plane identity lookup", () => {
  it("uses narrow fixed-search-path security-definer functions", () => {
    const sql = readFileSync(path.join(process.cwd(),
      "prisma/migrations/20260809120051_control_plane_identity_functions/migration.sql"), "utf8");
    expect(sql.match(/SECURITY DEFINER/g)).toHaveLength(3);
    expect(sql.match(/SET search_path = pg_catalog, public/g)).toHaveLength(3);
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.control_auth_user_by_email(TEXT) FROM PUBLIC");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.control_organization_context_membership(TEXT) FROM PUBLIC");
    expect(sql).toContain("lower(account.email) = lower(btrim(normalized_email))");
  });

  it("does not let login query the User delegate directly", () => {
    const login = readFileSync(path.join(process.cwd(), "src/server/auth/login.ts"), "utf8");
    expect(login).not.toMatch(/\.user\.(?:findUnique|findFirst|findMany)/);
    expect(login).toContain("findAuthenticationUserByEmail");
    expect(login).toContain("findActiveLoginMemberships");
  });

  it("resolves session membership through the narrow control function", () => {
    const context = readFileSync(path.join(process.cwd(), "src/server/organizations/context.ts"), "utf8");
    expect(context).toContain("findOrganizationContextMembership");
    expect(context).not.toMatch(/organizationMembership\.findUnique/);
  });
});
