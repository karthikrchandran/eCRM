import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("cell currency migration contract", () => {
  it("projects the legacy currency once without overwriting CellConfiguration", () => {
    const migrationPath = join(
      process.cwd(),
      "prisma",
      "migrations",
      "20260811211000_make_cell_configuration_currency_authoritative",
      "migration.sql"
    );

    expect(existsSync(migrationPath)).toBe(true);
    const migrationSql = readFileSync(migrationPath, "utf8");
    expect(migrationSql).toContain('SELECT "defaultCurrency" FROM "BusinessSettings"');
    expect(migrationSql).toContain('WHERE NOT EXISTS (SELECT 1 FROM "CellConfiguration"');
    expect(migrationSql).not.toContain('UPDATE "BusinessSettings"');
  });
});
