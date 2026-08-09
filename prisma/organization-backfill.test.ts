import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const prismaRoot = join(process.cwd(), "prisma");
const schema = readFileSync(join(prismaRoot, "schema.prisma"), "utf8");
const seed = readFileSync(join(prismaRoot, "seed.ts"), "utf8");
const migrationPath = join(
  prismaRoot,
  "migrations",
  "20260809120000_add_organization_tenancy",
  "migration.sql"
);
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

const tenantOwnedModels = [
  "SharedBusinessRecord",
  "SharedBusinessRecordVersion",
  "SharedRecordExportSnapshot",
  "SharedRecordExportSnapshotItem",
  "WorkflowEvent",
  "LeadCustomer",
  "Branch",
  "Contact",
  "Activity",
  "LeadOwnershipHistory",
  "SalesTask",
  "SalesTextNote",
  "SalesVoiceNote",
  "SalesVoiceNoteAction",
  "SalesDayReview",
  "SalesDayReviewItem",
  "PipelineStage",
  "Opportunity",
  "OpportunityOwnerSplit",
  "SalesTarget",
  "ProductService",
  "Proposal",
  "ProposalLineItem",
  "ProposalPdfAttachment",
  "Order",
  "OrderLineItem",
  "OrderOwnerSplitSnapshot",
  "ProductionTemplate",
  "ProductionTemplateStage",
  "ProductionWorkItem",
  "ProductionStageInstance",
  "ProductionNote",
  "Invoice",
  "Payment",
  "PaymentAllocation",
  "CostComponent",
  "Incentive",
  "IncentiveSplit"
] as const;

function block(source: string, kind: "model" | "enum", name: string) {
  const match = source.match(new RegExp(`${kind} ${name} \\{([\\s\\S]*?)\\n\\}`));
  expect(match, `${kind} ${name} must exist`).not.toBeNull();
  return match?.[1] ?? "";
}

function enumValues(name: string) {
  return block(schema, "enum", name)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

describe("organization tenancy schema contract", () => {
  test("defines the organization lifecycle and membership enums exactly", () => {
    expect(enumValues("OrganizationStatus")).toEqual([
      "PROVISIONING",
      "ACTIVE",
      "SUSPENDED",
      "OFFBOARDING",
      "DELETED"
    ]);
    expect(enumValues("OrganizationRole")).toEqual([
      "OWNER",
      "ADMIN",
      "SALES",
      "FINANCE",
      "PRODUCTION",
      "READ_ONLY"
    ]);
    expect(enumValues("MembershipStatus")).toEqual([
      "INVITED",
      "ACTIVE",
      "SUSPENDED",
      "REVOKED"
    ]);
  });

  test("defines the organization root and one-to-one settings and branding foundations", () => {
    const organization = block(schema, "model", "Organization");
    expect(organization).toMatch(/\bid\s+String\s+@id\s+@default\(cuid\(\)\)/);
    expect(organization).toMatch(/\bkey\s+String\s+@unique\b/);
    expect(organization).toMatch(/\blegalName\s+String\b/);
    expect(organization).toMatch(/\bdisplayName\s+String\b/);
    expect(organization).toMatch(/\bstatus\s+OrganizationStatus\s+@default\(PROVISIONING\)/);
    expect(organization).toMatch(/\bdeploymentRegion\s+String\b/);
    expect(organization).toMatch(/\bcreatedAt\s+DateTime\s+@default\(now\(\)\)/);
    expect(organization).toMatch(/\bupdatedAt\s+DateTime\s+@updatedAt/);
    expect(organization).toMatch(/\bversion\s+Int\s+@default\(1\)/);

    for (const modelName of ["OrganizationMembership", "OrganizationSettings", "OrganizationBranding"]) {
      const model = block(schema, "model", modelName);
      expect(model).toMatch(/\borganizationId\s+String\b/);
      expect(model).toMatch(/\borganization\s+Organization\s+@relation/);
    }

    const membership = block(schema, "model", "OrganizationMembership");
    expect(membership).toMatch(/\bid\s+String\s+@id\s+@default\(cuid\(\)\)/);
    expect(membership).toMatch(/\borganizationId\s+String\b/);
    expect(membership).toMatch(/\buserId\s+String\b/);
    expect(membership).toMatch(/\brole\s+OrganizationRole\b/);
    expect(membership).toMatch(/\bstatus\s+MembershipStatus\s+@default\(INVITED\)/);
    expect(membership).toMatch(/\bcreatedAt\s+DateTime\s+@default\(now\(\)\)/);
    expect(membership).toMatch(/\bupdatedAt\s+DateTime\s+@updatedAt/);
    expect(membership).toMatch(
      /\borganization\s+Organization\s+@relation\(fields: \[organizationId\], references: \[id\], onDelete: Cascade\)/
    );
    expect(membership).toMatch(
      /\buser\s+User\s+@relation\(fields: \[userId\], references: \[id\], onDelete: Cascade\)/
    );
    expect(membership).toContain("@@unique([organizationId, userId])");
    expect(membership).toContain("@@index([userId, status])");
    expect(block(schema, "model", "User")).toMatch(/\bmemberships\s+OrganizationMembership\[\]/);
  });

  test.each(tenantOwnedModels)("adds nullable expand ownership to %s", (modelName) => {
    const model = block(schema, "model", modelName);
    expect(model).toMatch(/\borganizationId\s+String\?/);
    expect(model).toMatch(/\borganization\s+Organization\?\s+@relation\(fields: \[organizationId\]/);
    expect(model).toContain("@@index([organizationId])");
  });

  test("scopes shared external-key uniqueness to the organization", () => {
    const sharedRecord = block(schema, "model", "SharedBusinessRecord");
    expect(sharedRecord).toContain("@@unique([organizationId, entityType, externalKey])");
    expect(sharedRecord).not.toMatch(/@@unique\(\[entityType, externalKey\]\)/);
  });
});

describe("ARA Global backfill migration contract", () => {
  test("uses the prescribed migration and creates the organization roots repeat-safely", () => {
    expect(existsSync(migrationPath)).toBe(true);
    expect(migration).toContain("ara-global");
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS "Organization"/i);
    expect(migration).toMatch(/ON CONFLICT \("key"\) DO UPDATE/i);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "organizationId"/i);
    expect(migration).toMatch(/CREATE INDEX IF NOT EXISTS/i);
  });

  test("documents legacy role and active-state membership mapping", () => {
    expect(migration).toMatch(/User\.role.*ADMIN.*OrganizationRole.*ADMIN/is);
    expect(migration).toMatch(/User\.role.*SALES.*OrganizationRole.*SALES/is);
    expect(migration).toMatch(/User\.active.*MembershipStatus/is);
  });

  test.each(tenantOwnedModels)("reconciles and gates ownership for %s", (modelName) => {
    expect(migration).toContain(`'${modelName}'`);
    expect(migration).toContain(`"${modelName}"`);
  });

  test("records accounting and aborts unresolved or mismatched ownership", () => {
    expect(migration).toContain("OrganizationTenancyMigrationReconciliation");
    expect(migration).toMatch(/beforeCount/);
    expect(migration).toMatch(/afterCount/);
    expect(migration).toMatch(/nullCount/);
    expect(migration).toMatch(/mismatchCount/);
    expect(migration).toMatch(/RAISE EXCEPTION.*unresolved/is);
    expect(migration).toMatch(/RAISE EXCEPTION.*mismatch/is);
  });
});

describe("seed organization contract", () => {
  test("idempotently provisions ARA organization configuration and memberships", () => {
    expect(seed).toContain('key: "ara-global"');
    expect(seed).toMatch(/organization\.upsert/);
    expect(seed).toMatch(/organizationSettings\.upsert/);
    expect(seed).toMatch(/organizationBranding\.upsert/);
    expect(seed).toMatch(/organizationMembership\.upsert/);
  });
});

function parseDatabaseIdentity(rawUrl: string) {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("ECRM_TENANCY_TEST_DATABASE_URL must be a valid PostgreSQL URL");
  }

  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error("ECRM_TENANCY_TEST_DATABASE_URL must be a PostgreSQL URL");
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  if (!databaseName) {
    throw new Error("ECRM_TENANCY_TEST_DATABASE_URL must include a database name");
  }

  const port = parsed.port || "5432";
  return {
    databaseName,
    host: parsed.hostname,
    identity: `${parsed.hostname.toLowerCase()}:${port}/${databaseName}`,
    port
  };
}

function validateIntegrationDatabaseUrl(dedicatedUrl: string, ordinaryUrl?: string) {
  const dedicated = parseDatabaseIdentity(dedicatedUrl);

  if (!/(?:disposable|rehearsal|test)/i.test(dedicated.databaseName)) {
    throw new Error("database name must include an explicit disposable test marker");
  }

  if (ordinaryUrl) {
    const ordinary = parseDatabaseIdentity(ordinaryUrl);
    if (ordinary.identity === dedicated.identity) {
      throw new Error(
        "ECRM_TENANCY_TEST_DATABASE_URL must not identify the ordinary DATABASE_URL database"
      );
    }
  }

  return {
    databaseName: dedicated.databaseName,
    host: dedicated.host,
    port: dedicated.port
  };
}

describe("organization tenancy integration safety", () => {
  const safeUrl = "postgresql://test-user:test-password@127.0.0.1:55441/ecrm_tenancy_disposable_test_example";

  test("accepts a distinctly named disposable database without exposing credentials", () => {
    expect(validateIntegrationDatabaseUrl(safeUrl)).toEqual({
      databaseName: "ecrm_tenancy_disposable_test_example",
      host: "127.0.0.1",
      port: "55441"
    });
  });

  test("refuses the ordinary application database", () => {
    expect(() => validateIntegrationDatabaseUrl(safeUrl, safeUrl)).toThrow(
      "ECRM_TENANCY_TEST_DATABASE_URL must not identify the ordinary DATABASE_URL database"
    );
  });

  test("refuses a database name without an explicit disposable marker", () => {
    expect(() =>
      validateIntegrationDatabaseUrl("postgresql://test-user:test-password@127.0.0.1:55441/ecrm")
    ).toThrow("database name must include an explicit disposable test marker");
  });
});

const integrationDatabaseUrl = process.env.ECRM_TENANCY_TEST_DATABASE_URL;
const integrationDescribe = integrationDatabaseUrl ? describe.sequential : describe.skip;

type CommandResult = {
  output: string;
  status: number | null;
};

type TableCount = {
  rowCount: number;
  tableName: string;
};

type OwnershipCount = TableCount & {
  nullCount: number;
};

type ReconciliationRow = {
  afterCount: number;
  beforeCount: number;
  mismatchCount: number;
  nullCount: number;
  tableName: string;
};

const seedCountTables = [
  "User",
  "BusinessSettings",
  "Organization",
  "OrganizationMembership",
  "OrganizationSettings",
  "OrganizationBranding",
  ...tenantOwnedModels
] as const;

function quoteIdentifier(identifier: string) {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(identifier)) {
    throw new Error("Unsafe integration-test SQL identifier");
  }
  return `"${identifier}"`;
}

function sanitizeCommandOutput(output: string, databaseUrl: string) {
  return output.split(databaseUrl).join("[redacted-database-url]");
}

function runPrismaCommand(args: string[], databaseUrl: string): CommandResult {
  const prismaCli = join(process.cwd(), "node_modules", "prisma", "build", "index.js");
  const prismaArgs = args[0] === "prisma" ? args.slice(1) : args;
  const result = spawnSync(process.execPath, [prismaCli, ...prismaArgs], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      NODE_ENV: "test"
    },
    timeout: 120_000,
    windowsHide: true
  });
  const output = sanitizeCommandOutput(
    `${result.stdout ?? ""}\n${result.stderr ?? ""}${result.error ? `\n${result.error.message}` : ""}`,
    databaseUrl
  );
  return { output, status: result.status };
}

function runPrismaCommandSuccessfully(args: string[], databaseUrl: string) {
  const result = runPrismaCommand(args, databaseUrl);
  if (result.status !== 0) {
    throw new Error(`Prisma command failed (${args.join(" ")}):\n${result.output}`);
  }
  return result;
}

async function readTableCounts(client: PrismaClient, tableNames: readonly string[]) {
  const query = tableNames
    .map(
      (tableName) =>
        `SELECT '${tableName}' AS "tableName", COUNT(*)::integer AS "rowCount" FROM ${quoteIdentifier(tableName)}`
    )
    .join(" UNION ALL ");
  return client.$queryRawUnsafe<TableCount[]>(`${query} ORDER BY "tableName"`);
}

async function readOwnershipCounts(client: PrismaClient) {
  const query = tenantOwnedModels
    .map(
      (tableName) =>
        `SELECT '${tableName}' AS "tableName", COUNT(*)::integer AS "rowCount", COUNT(*) FILTER (WHERE "organizationId" IS NULL)::integer AS "nullCount" FROM ${quoteIdentifier(tableName)}`
    )
    .join(" UNION ALL ");
  return client.$queryRawUnsafe<OwnershipCount[]>(`${query} ORDER BY "tableName"`);
}

async function readReconciliation(client: PrismaClient) {
  return client.$queryRawUnsafe<ReconciliationRow[]>(`
    SELECT
      "tableName",
      "beforeCount"::integer AS "beforeCount",
      "afterCount"::integer AS "afterCount",
      "nullCount"::integer AS "nullCount",
      "mismatchCount"::integer AS "mismatchCount"
    FROM "OrganizationTenancyMigrationReconciliation"
    WHERE "migrationKey" = '20260809120000_add_organization_tenancy'
    ORDER BY "tableName"
  `);
}

async function readSeedFingerprint(client: PrismaClient) {
  const counts = await readTableCounts(client, seedCountTables);
  const users = await client.$queryRawUnsafe<
    Array<{ active: boolean; email: string; name: string; role: string }>
  >(`
    SELECT "email", "name", "role"::text AS "role", "active"
    FROM "User"
    ORDER BY "email"
  `);
  const stages = await client.$queryRawUnsafe<
    Array<{ active: boolean; kind: string; name: string; sortOrder: number }>
  >(`
    SELECT "name", "kind"::text AS "kind", "sortOrder", "active"
    FROM "PipelineStage"
    ORDER BY "sortOrder"
  `);
  return { counts, stages, users };
}

function runTenancySql(databaseUrl: string) {
  return runPrismaCommand(
    ["prisma", "db", "execute", "--file", migrationPath, "--schema", join(prismaRoot, "schema.prisma")],
    databaseUrl
  );
}

function runTenancySqlSuccessfully(databaseUrl: string) {
  const result = runTenancySql(databaseUrl);
  if (result.status !== 0) {
    throw new Error(`Tenancy SQL failed:\n${result.output}`);
  }
}

integrationDescribe("organization tenancy PostgreSQL integration", () => {
  let client: PrismaClient;
  let databaseIdentity: ReturnType<typeof validateIntegrationDatabaseUrl>;
  let firstSeedFingerprint: Awaited<ReturnType<typeof readSeedFingerprint>>;
  let ownershipBeforeBackfill: OwnershipCount[];

  beforeAll(async () => {
    if (!integrationDatabaseUrl) {
      throw new Error("ECRM_TENANCY_TEST_DATABASE_URL is required for integration mode");
    }

    databaseIdentity = validateIntegrationDatabaseUrl(integrationDatabaseUrl, process.env.DATABASE_URL);
    client = new PrismaClient({ datasources: { db: { url: integrationDatabaseUrl } } });

    const [actualDatabase] = await client.$queryRawUnsafe<
      Array<{ databaseName: string; port: number; publicTableCount: number }>
    >(`
      SELECT
        current_database() AS "databaseName",
        inet_server_port() AS "port",
        (SELECT COUNT(*)::integer FROM pg_tables WHERE schemaname = 'public') AS "publicTableCount"
    `);

    expect(actualDatabase).toEqual({
      databaseName: databaseIdentity.databaseName,
      port: Number(databaseIdentity.port),
      publicTableCount: 0
    });

    runPrismaCommandSuccessfully(["prisma", "migrate", "deploy"], integrationDatabaseUrl);
  }, 120_000);

  afterAll(async () => {
    await client?.$disconnect();
  });

  test(
    "applies the full migration chain and executes the seed",
    async () => {
      const expectedMigrationCount = readdirSync(join(prismaRoot, "migrations"), {
        withFileTypes: true
      }).filter(
        (entry) => entry.isDirectory() && existsSync(join(prismaRoot, "migrations", entry.name, "migration.sql"))
      ).length;
      const [migrationState] = await client.$queryRawUnsafe<
        Array<{ appliedCount: number; failedCount: number }>
      >(`
        SELECT
          COUNT(*) FILTER (WHERE finished_at IS NOT NULL)::integer AS "appliedCount",
          COUNT(*) FILTER (WHERE finished_at IS NULL)::integer AS "failedCount"
        FROM "_prisma_migrations"
      `);

      expect(migrationState).toEqual({ appliedCount: expectedMigrationCount, failedCount: 0 });
      runPrismaCommandSuccessfully(["prisma", "db", "seed"], integrationDatabaseUrl!);

      firstSeedFingerprint = await readSeedFingerprint(client);
      const counts = Object.fromEntries(
        firstSeedFingerprint.counts.map(({ rowCount, tableName }) => [tableName, rowCount])
      );
      expect(counts.User).toBe(3);
      expect(counts.LeadCustomer).toBe(2);
      expect(counts.PipelineStage).toBe(7);
      expect(counts.Order).toBe(1);
    },
    120_000
  );

  test("creates ARA configuration and maps every existing user membership", async () => {
    const organizations = await client.$queryRawUnsafe<
      Array<{
        brandingCount: number;
        currency: string;
        deploymentRegion: string;
        key: string;
        settingsCount: number;
        status: string;
        timezone: string;
      }>
    >(`
      SELECT
        o."key",
        o."status"::text AS "status",
        o."deploymentRegion",
        s."currency"::text AS "currency",
        s."timezone",
        COUNT(DISTINCT s."id")::integer AS "settingsCount",
        COUNT(DISTINCT b."id")::integer AS "brandingCount"
      FROM "Organization" o
      JOIN "OrganizationSettings" s ON s."organizationId" = o."id"
      JOIN "OrganizationBranding" b ON b."organizationId" = o."id"
      WHERE o."key" = 'ara-global'
      GROUP BY o."key", o."status", o."deploymentRegion", s."currency", s."timezone"
    `);
    expect(organizations).toEqual([
      {
        brandingCount: 1,
        currency: "INR",
        deploymentRegion: "ap-south-1",
        key: "ara-global",
        settingsCount: 1,
        status: "ACTIVE",
        timezone: "Asia/Kolkata"
      }
    ]);

    const memberships = await client.$queryRawUnsafe<
      Array<{
        active: boolean;
        legacyRole: string;
        membershipRole: string | null;
        membershipStatus: string | null;
        userId: string;
      }>
    >(`
      SELECT
        u."id" AS "userId",
        u."role"::text AS "legacyRole",
        u."active",
        m."role"::text AS "membershipRole",
        m."status"::text AS "membershipStatus"
      FROM "User" u
      LEFT JOIN "OrganizationMembership" m
        ON m."userId" = u."id"
       AND m."organizationId" = (SELECT "id" FROM "Organization" WHERE "key" = 'ara-global')
      ORDER BY u."id"
    `);
    expect(memberships).toHaveLength(3);
    for (const membership of memberships) {
      expect(membership.membershipRole).toBe(membership.legacyRole);
      expect(membership.membershipStatus).toBe(membership.active ? "ACTIVE" : "SUSPENDED");
    }
  });

  test(
    "reruns the seed idempotently without changing logical fixtures or counts",
    async () => {
      runPrismaCommandSuccessfully(["prisma", "db", "seed"], integrationDatabaseUrl!);
      expect(await readSeedFingerprint(client)).toEqual(firstSeedFingerprint);
    },
    120_000
  );

  test(
    "restores deliberately cleared ownership and reconciles every concrete table",
    async () => {
      ownershipBeforeBackfill = await readOwnershipCounts(client);
      for (const tableName of tenantOwnedModels) {
        await client.$executeRawUnsafe(
          `UPDATE ${quoteIdentifier(tableName)} SET "organizationId" = NULL`
        );
      }

      const cleared = await readOwnershipCounts(client);
      const populatedRows = cleared.reduce((total, row) => total + row.rowCount, 0);
      const clearedRows = cleared.reduce((total, row) => total + row.nullCount, 0);
      expect(populatedRows).toBeGreaterThan(0);
      expect(clearedRows).toBe(populatedRows);

      runTenancySqlSuccessfully(integrationDatabaseUrl!);

      const restored = await readOwnershipCounts(client);
      expect(restored.map(({ nullCount, rowCount, tableName }) => ({ nullCount, rowCount, tableName }))).toEqual(
        ownershipBeforeBackfill.map(({ rowCount, tableName }) => ({ nullCount: 0, rowCount, tableName }))
      );

      const reconciliation = await readReconciliation(client);
      expect(reconciliation).toHaveLength(tenantOwnedModels.length);
      expect(reconciliation.map(({ tableName }) => tableName)).toEqual([...tenantOwnedModels].sort());
      for (const row of reconciliation) {
        expect(row.beforeCount, row.tableName).toBe(row.afterCount);
        expect(row.nullCount, row.tableName).toBe(0);
        expect(row.mismatchCount, row.tableName).toBe(0);
      }
    },
    120_000
  );

  test(
    "executes the tenancy SQL a second time without changing counts or reconciliation",
    async () => {
      const countsBefore = await readOwnershipCounts(client);
      const reconciliationBefore = await readReconciliation(client);
      runTenancySqlSuccessfully(integrationDatabaseUrl!);
      expect(await readOwnershipCounts(client)).toEqual(countsBefore);
      expect(await readReconciliation(client)).toEqual(reconciliationBefore);
    },
    120_000
  );

  test(
    "aborts with the unresolved-row gate for an orphaned child",
    async () => {
      await client.$executeRawUnsafe(`
        ALTER TABLE "SharedBusinessRecordVersion"
        DROP CONSTRAINT "SharedBusinessRecordVersion_recordId_fkey"
      `);

      try {
        await client.$executeRawUnsafe(`
          INSERT INTO "SharedBusinessRecordVersion" (
            "id", "recordId", "versionNumber", "entityType", "sourceApp", "changeType", "snapshot", "organizationId"
          ) VALUES (
            'integration_unresolved_version', 'integration_missing_record', 1, 'LEAD', 'integration-test', 'TEST', '{}'::jsonb, NULL
          )
        `);

        const result = runTenancySql(integrationDatabaseUrl!);
        expect(result.status).not.toBe(0);
        expect(result.output).toContain(
          "Organization tenancy backfill unresolved: 1 rows still have null organizationId"
        );
        const [orphan] = await client.$queryRawUnsafe<Array<{ nullOwnership: boolean }>>(`
          SELECT "organizationId" IS NULL AS "nullOwnership"
          FROM "SharedBusinessRecordVersion"
          WHERE "id" = 'integration_unresolved_version'
        `);
        expect(orphan).toEqual({ nullOwnership: true });
      } finally {
        await client.$executeRawUnsafe(`
          DELETE FROM "SharedBusinessRecordVersion" WHERE "id" = 'integration_unresolved_version'
        `);
        await client.$executeRawUnsafe(`
          ALTER TABLE "SharedBusinessRecordVersion"
          ADD CONSTRAINT "SharedBusinessRecordVersion_recordId_fkey"
          FOREIGN KEY ("recordId") REFERENCES "SharedBusinessRecord"("id")
          ON DELETE CASCADE ON UPDATE CASCADE
        `);
      }

      runTenancySqlSuccessfully(integrationDatabaseUrl!);
    },
    120_000
  );

  test(
    "aborts with the mismatch gate for a cross-organization parent and child",
    async () => {
      const [branch] = await client.$queryRawUnsafe<Array<{ id: string; organizationId: string }>>(`
        SELECT "id", "organizationId"
        FROM "Branch"
        ORDER BY "id"
        LIMIT 1
      `);
      expect(branch).toBeDefined();

      await client.$executeRawUnsafe(`
        INSERT INTO "Organization" (
          "id", "key", "legalName", "displayName", "status", "deploymentRegion", "updatedAt"
        ) VALUES (
          'org_integration_mismatch', 'integration-mismatch-test', 'Integration Mismatch',
          'Integration Mismatch', 'ACTIVE', 'test-only', CURRENT_TIMESTAMP
        )
      `);
      await client.$executeRawUnsafe(`
        UPDATE "Branch"
        SET "organizationId" = 'org_integration_mismatch'
        WHERE "id" = '${branch.id}'
      `);

      try {
        const result = runTenancySql(integrationDatabaseUrl!);
        expect(result.status).not.toBe(0);
        expect(result.output).toMatch(
          /Organization tenancy backfill mismatch: \d+ parent\/child organization relationships disagree/
        );
      } finally {
        await client.$executeRawUnsafe(`
          UPDATE "Branch"
          SET "organizationId" = '${branch.organizationId}'
          WHERE "id" = '${branch.id}'
        `);
        await client.$executeRawUnsafe(`
          DELETE FROM "Organization" WHERE "id" = 'org_integration_mismatch'
        `);
      }

      runTenancySqlSuccessfully(integrationDatabaseUrl!);
      for (const row of await readReconciliation(client)) {
        expect(row.beforeCount, row.tableName).toBe(row.afterCount);
        expect(row.nullCount, row.tableName).toBe(0);
        expect(row.mismatchCount, row.tableName).toBe(0);
      }
    },
    120_000
  );
});
