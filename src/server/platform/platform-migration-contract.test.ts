import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const migrationDirectory = join(projectRoot, "prisma", "platform", "migrations");
const initialMigrationDirectory = join(migrationDirectory, "20260811000000_init_platform");

describe("platform Prisma migration contract", () => {
  it("uses an isolated migration history when deploying the platform schema", () => {
    const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const configPath = join(projectRoot, "prisma", "platform.config.ts");

    expect(packageJson.scripts["prisma:platform:migrate"]).toContain("prisma migrate deploy");
    expect(packageJson.scripts["prisma:platform:migrate"]).toContain("--schema prisma/platform.schema.prisma");
    expect(packageJson.scripts["prisma:platform:migrate"]).toContain("--config prisma/platform.config.ts");
    expect(packageJson.scripts["prisma:platform:verify"]).toBe(
      'set "PLATFORM_DATABASE_URL=postgresql://placeholder:placeholder@127.0.0.1:5432/platform" && npx prisma validate --config prisma/platform.config.ts && npm run prisma:platform:generate && npm test -- src/server/platform/platform-migration-contract.test.ts'
    );
    expect(existsSync(configPath)).toBe(true);
    const config = readFileSync(configPath, "utf8");
    expect(config).toContain('schema: "platform.schema.prisma"');
    expect(config).toContain('path: "platform/migrations"');
    expect(existsSync(join(migrationDirectory, "migration_lock.toml"))).toBe(true);
  });

  it("contains a first deployable platform migration for every platform enum and table", () => {
    const migrationPath = join(initialMigrationDirectory, "migration.sql");

    expect(existsSync(migrationPath)).toBe(true);
    const migrationSql = readFileSync(migrationPath, "utf8");
    for (const statement of [
      'CREATE TYPE "CustomerCellLifecycleStatus"',
      'CREATE TYPE "ProvisioningResult"',
      'CREATE TABLE "CustomerCell"',
      'CREATE TABLE "InstallationConnection"',
      'CREATE TABLE "ProvisioningAttempt"',
      'CREATE TABLE "ProvisioningAction"',
      'CREATE TABLE "ControlPlaneAuditEvent"',
      'CREATE TABLE "SupportGrant"',
      'ALTER TABLE "InstallationConnection" ADD CONSTRAINT',
      'ALTER TABLE "ProvisioningAttempt" ADD CONSTRAINT',
      'ALTER TABLE "ProvisioningAction" ADD CONSTRAINT',
      'ALTER TABLE "ControlPlaneAuditEvent" ADD CONSTRAINT',
      'ALTER TABLE "SupportGrant" ADD CONSTRAINT'
    ]) {
      expect(migrationSql).toContain(statement);
    }
    expect(migrationSql).toContain('"error" TEXT');
    expect(migrationSql).toContain('"errorCode" TEXT');
  });
});
