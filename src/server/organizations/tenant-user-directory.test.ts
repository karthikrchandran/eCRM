import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("tenant-safe user directory", () => {
  it("uses RLS membership resolution without exposing authentication columns", () => {
    const sql = readFileSync(join(process.cwd(),
      "prisma/migrations/20260809120044_tenant_user_directory/migration.sql"), "utf8");
    const executable = sql.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n");

    expect(executable).toContain("SECURITY DEFINER");
    expect(executable).toContain('ALTER TABLE "User" ENABLE ROW LEVEL SECURITY');
    expect(executable).toContain('CREATE POLICY "User_tenant_directory"');
    expect(executable).toContain("current_setting('app.organization_id', true)");
    expect(executable).toContain('FROM public."OrganizationMembership"');
    expect(executable).not.toContain("passwordHash");
  });
});
