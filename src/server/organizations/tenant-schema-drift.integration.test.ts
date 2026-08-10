import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { validateDisposableDatabaseUrls } from "./disposable-database";

const ownerValue = process.env.TEST_DATABASE_URL;
const tenantValue = process.env.TEST_TENANT_DATABASE_URL;
const integration = describe.runIf(Boolean(ownerValue && tenantValue));

integration("Prisma tenant contract drift", () => {
  it("produces an empty migration after the complete history", () => {
    const { ownerUrl } = validateDisposableDatabaseUrls(ownerValue, tenantValue);
    const executable = process.execPath;
    const output = execFileSync(executable, [
      "node_modules/prisma/build/index.js", "migrate", "diff",
      "--from-url", ownerUrl,
      "--to-schema-datamodel", "prisma/schema.prisma",
      "--script"
    ], { cwd: process.cwd(), encoding: "utf8" });

    expect(output.trim()).toBe("-- This is an empty migration.");
    expect(output).not.toMatch(/DROP (?:CONSTRAINT|INDEX).*tenant/i);
  });
});
