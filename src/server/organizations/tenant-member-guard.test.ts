import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { assertTenantMember } from "./tenant-member-guard";

describe("transaction-local tenant member guard", () => {
  it("rejects a member revoked after any control-plane precheck", async () => {
    const query = vi.fn().mockResolvedValue([{ allowed: false }]);
    await expect(assertTenantMember({ $queryRaw: query } as never, "user_revoked", ["SALES"]))
      .rejects.toThrow("Organization member was not found.");
    expect(query).toHaveBeenCalledOnce();
  });

  it("uses a hardened executable database function that locks active membership", () => {
    const sql = readFileSync(join(process.cwd(),
      "prisma/migrations/20260809120045_transactional_membership_guard/migration.sql"), "utf8");
    const executable = sql.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n");
    expect(executable).toContain("SECURITY DEFINER");
    expect(executable).toContain("SET search_path = pg_catalog, public");
    expect(executable).toContain("FOR KEY SHARE");
    expect(executable).toContain("current_setting('app.organization_id', true)");
    expect(executable).toContain("membership.status = 'ACTIVE'");
    expect(executable).toContain("organization.status = 'ACTIVE'");
    expect(executable).toContain("account.active");
    expect(executable).toContain("REVOKE ALL ON FUNCTION");
  });
});
