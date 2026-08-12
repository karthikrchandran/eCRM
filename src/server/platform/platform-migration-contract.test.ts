import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const migrationDirectory = join(projectRoot, "prisma", "platform", "migrations");
const initialMigrationDirectory = join(migrationDirectory, "20260811000000_init_platform");
const leaseFenceMigrationDirectory = join(migrationDirectory, "20260811190000_fence_provisioning_leases");
const planEntitlementMigrationDirectory = join(migrationDirectory, "20260811210000_add_cell_plan_entitlements");
const controlReconciliationMigrationDirectory = join(migrationDirectory, "20260812120000_operationalize_control_projection_reconciliation");

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

  it("adds a durable lease fence to provisioning attempts", () => {
    const schema = readFileSync(join(projectRoot, "prisma", "platform.schema.prisma"), "utf8");
    const migrationPath = join(leaseFenceMigrationDirectory, "migration.sql");

    expect(schema).toContain("leaseVersion");
    expect(existsSync(migrationPath)).toBe(true);
    expect(readFileSync(migrationPath, "utf8")).toContain('ADD COLUMN "leaseVersion" INTEGER NOT NULL DEFAULT 1');
  });

  it("persists commercial plan metadata in the control plane", () => {
    const schema = readFileSync(join(projectRoot, "prisma", "platform.schema.prisma"), "utf8");
    const migrationPath = join(planEntitlementMigrationDirectory, "migration.sql");

    expect(schema).toContain("planCode");
    expect(schema).toContain("allowedModules");
    expect(existsSync(migrationPath)).toBe(true);
    const migrationSql = readFileSync(migrationPath, "utf8");
    expect(migrationSql).toContain('ADD COLUMN "planCode"');
    expect(migrationSql).toContain('ADD COLUMN "allowedModules"');
  });

  it("persists deletion staging and leased retry/dead-letter reconciliation state", () => {
    const schema = readFileSync(join(projectRoot, "prisma", "platform.schema.prisma"), "utf8");
    const migrationPath = join(controlReconciliationMigrationDirectory, "migration.sql");

    expect(schema).toContain("DELETING");
    expect(schema).toContain("DEAD_LETTER");
    expect(schema).toContain("nextAttemptAt");
    expect(schema).toContain("leaseOwner");
    expect(schema).toContain("leaseExpiresAt");
    expect(schema).toContain("deadLetteredAt");
    expect(existsSync(migrationPath)).toBe(true);
    expect(readFileSync(migrationPath, "utf8")).toContain("DEAD_LETTER");

    const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts["worker:control-projections"]).toBe("tsx src/server/platform/control-projection-worker.ts");
  });
});
