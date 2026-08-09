import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync
} from "node:fs";
import { tmpdir } from "node:os";
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
const tenancyMigrationPaths = readdirSync(join(prismaRoot, "migrations"), {
  withFileTypes: true
})
  .filter(
    (entry) =>
      entry.isDirectory() &&
      entry.name >= "20260809120000_" &&
      entry.name <= "20260809120042_\uffff" &&
      existsSync(join(prismaRoot, "migrations", entry.name, "migration.sql"))
  )
  .sort((left, right) => left.name.localeCompare(right.name))
  .map((entry) => join(prismaRoot, "migrations", entry.name, "migration.sql"));
const tenancyBackfillPath = tenancyMigrationPaths.find((path) =>
  path.includes("20260809120041_backfill_organization_ownership")
);
const migration = tenancyMigrationPaths.map((path) => readFileSync(path, "utf8")).join("\n");

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

  test("declares both legacy and tenant shared external-key uniqueness during expand", () => {
    const sharedRecord = block(schema, "model", "SharedBusinessRecord");
    expect(sharedRecord).toContain("@@unique([entityType, externalKey])");
    expect(sharedRecord).toContain("@@unique([organizationId, entityType, externalKey])");
  });
});

describe("ARA Global backfill migration contract", () => {
  test("uses the prescribed migration and creates the organization roots repeat-safely", () => {
    expect(existsSync(migrationPath)).toBe(true);
    expect(migration).toContain("ara-global");
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS "Organization"/i);
    expect(migration).toMatch(/ON CONFLICT \("key"\) DO NOTHING/i);
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

  test("keeps legacy external-key uniqueness while adding the tenant index concurrently", () => {
    expect(migration).not.toContain('DROP INDEX IF EXISTS "SharedBusinessRecord_entityType_externalKey_key"');
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "SharedBusinessRecord_organizationId_entityType_externalKey_key"/
    );
  });

  test("replays without overwriting organization operational state", () => {
    expect(migration).toMatch(/ON CONFLICT \("key"\) DO NOTHING/);
    expect(migration).toMatch(/ON CONFLICT \("organizationId"\) DO NOTHING/);
    expect(migration).toMatch(/ON CONFLICT \("organizationId", "userId"\) DO NOTHING/);
    expect(migration).not.toMatch(/ON CONFLICT[\s\S]{0,120}DO UPDATE/);
  });

  test("counts missing parents as ownership mismatches", () => {
    expect(migration).toContain("LEFT JOIN %I parent");
    expect(migration).toContain('parent."id" IS NULL');
  });

  test("separates concurrent indexes, bounded backfill, and constraint validation stages", () => {
    const firstConcurrentIndex = migration.indexOf("CREATE INDEX CONCURRENTLY");
    const backfillTransaction = migration.indexOf("BEGIN;", firstConcurrentIndex);
    const backfillCommit = migration.indexOf("COMMIT;", backfillTransaction);
    const constraintValidation = migration.indexOf("VALIDATE CONSTRAINT", backfillCommit);

    expect(migration).toContain("SET lock_timeout");
    expect(migration).toContain("SET statement_timeout");
    expect(firstConcurrentIndex).toBeGreaterThan(0);
    expect(backfillTransaction).toBeGreaterThan(firstConcurrentIndex);
    expect(backfillCommit).toBeGreaterThan(backfillTransaction);
    expect(constraintValidation).toBeGreaterThan(backfillCommit);
    expect(migration).toContain("NOT VALID");
    expect(migration.slice(backfillTransaction, backfillCommit)).not.toContain("CREATE INDEX CONCURRENTLY");
    expect(migration.trimEnd().endsWith("COMMIT;")).toBe(false);
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
  const schemaParameters = parsed.searchParams.getAll("schema");
  if (schemaParameters.length > 1) {
    throw new Error("ECRM_TENANCY_TEST_DATABASE_URL must include at most one schema parameter");
  }
  const schemaName = schemaParameters[0] ?? "public";
  const databaseIdentity = `${parsed.hostname.toLowerCase()}:${port}/${databaseName}`;
  return {
    databaseName,
    databaseIdentity,
    host: parsed.hostname,
    identity: `${databaseIdentity}?schema=${schemaName}`,
    port,
    schema: schemaName
  };
}

function validateIntegrationDatabaseUrl(dedicatedUrl: string, ordinaryUrl?: string) {
  const dedicated = parseDatabaseIdentity(dedicatedUrl);

  if (dedicated.schema !== "public") {
    throw new Error("ECRM_TENANCY_TEST_DATABASE_URL schema must be public");
  }

  if (!/(?:disposable|rehearsal|test)/i.test(dedicated.databaseName)) {
    throw new Error("database name must include an explicit disposable test marker");
  }

  if (ordinaryUrl) {
    const ordinary = parseDatabaseIdentity(ordinaryUrl);
    if (ordinary.databaseIdentity === dedicated.databaseIdentity) {
      throw new Error(
        "ECRM_TENANCY_TEST_DATABASE_URL must not identify the ordinary DATABASE_URL database"
      );
    }
  }

  return {
    databaseName: dedicated.databaseName,
    host: dedicated.host,
    identity: dedicated.identity,
    port: dedicated.port,
    schema: dedicated.schema
  };
}

describe("organization tenancy integration safety", () => {
  const safeUrl = "postgresql://test-user:test-password@127.0.0.1:55441/ecrm_tenancy_disposable_test_example";

  test("accepts a distinctly named disposable database without exposing credentials", () => {
    expect(validateIntegrationDatabaseUrl(safeUrl)).toEqual({
      databaseName: "ecrm_tenancy_disposable_test_example",
      host: "127.0.0.1",
      identity: "127.0.0.1:55441/ecrm_tenancy_disposable_test_example?schema=public",
      port: "55441",
      schema: "public"
    });
  });

  test.each(["public", "%70ublic"])(
    "accepts and canonicalizes the explicit public schema %s",
    (schemaName) => {
      expect(validateIntegrationDatabaseUrl(`${safeUrl}?schema=${schemaName}`)).toMatchObject({
        identity: "127.0.0.1:55441/ecrm_tenancy_disposable_test_example?schema=public",
        schema: "public"
      });
    }
  );

  test.each(["customer_data", "PUBLIC", "%50UBLIC"])(
    "rejects non-public schema %s before a caller can mutate it",
    (schemaName) => {
      let mutationAttempted = false;

      expect(() => {
        validateIntegrationDatabaseUrl(`${safeUrl}?schema=${schemaName}`);
        mutationAttempted = true;
      }).toThrow("ECRM_TENANCY_TEST_DATABASE_URL schema must be public");
      expect(mutationAttempted).toBe(false);
    }
  );

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

function runPrismaCommand(args: string[], databaseUrl: string, input?: string): CommandResult {
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
    input,
    timeout: 120_000,
    windowsHide: true
  });
  const output = sanitizeCommandOutput(
    `${result.stdout ?? ""}\n${result.stderr ?? ""}${result.error ? `\n${result.error.message}` : ""}`,
    databaseUrl
  );
  return { output, status: result.status };
}

function runPrismaCommandSuccessfully(args: string[], databaseUrl: string, input?: string) {
  const result = runPrismaCommand(args, databaseUrl, input);
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
  if (!tenancyBackfillPath) {
    throw new Error("Organization tenancy backfill migration is missing");
  }
  return runPrismaCommand(
    [
      "prisma",
      "db",
      "execute",
      "--file",
      tenancyBackfillPath,
      "--schema",
      join(prismaRoot, "schema.prisma")
    ],
    databaseUrl
  );
}

function runFullTenancySql(databaseUrl: string) {
  const outputs: string[] = [];
  for (const path of tenancyMigrationPaths) {
    const result = runPrismaCommand(
      ["prisma", "db", "execute", "--file", path, "--schema", join(prismaRoot, "schema.prisma")],
      databaseUrl
    );
    outputs.push(result.output);
    if (result.status !== 0) {
      return { output: outputs.join("\n"), status: result.status };
    }
  }
  return { output: outputs.join("\n"), status: 0 };
}

function runTenancySqlSuccessfully(databaseUrl: string) {
  const result = runTenancySql(databaseUrl);
  if (result.status !== 0) {
    throw new Error(`Tenancy SQL failed:\n${result.output}`);
  }
}

function runFullTenancySqlSuccessfully(databaseUrl: string) {
  const result = runFullTenancySql(databaseUrl);
  if (result.status !== 0) {
    throw new Error(`Full tenancy SQL replay failed:\n${result.output}`);
  }
}

function createPreWp2PrismaRoot() {
  const root = mkdtempSync(join(tmpdir(), "ecrm-tenancy-pre-wp2-"));
  const temporaryPrismaRoot = join(root, "prisma");
  const temporaryMigrationsRoot = join(temporaryPrismaRoot, "migrations");
  mkdirSync(temporaryMigrationsRoot, { recursive: true });
  copyFileSync(join(prismaRoot, "schema.prisma"), join(temporaryPrismaRoot, "schema.prisma"));
  copyFileSync(
    join(prismaRoot, "migrations", "migration_lock.toml"),
    join(temporaryMigrationsRoot, "migration_lock.toml")
  );

  for (const entry of readdirSync(join(prismaRoot, "migrations"), { withFileTypes: true })) {
    if (
      entry.isDirectory() &&
      entry.name < "20260809120000_"
    ) {
      cpSync(
        join(prismaRoot, "migrations", entry.name),
        join(temporaryMigrationsRoot, entry.name),
        { recursive: true }
      );
    }
  }

  return { root, schemaPath: join(temporaryPrismaRoot, "schema.prisma") };
}

const legacyFixtureSql = `
BEGIN;

INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "active", "updatedAt") VALUES
  ('legacy_user_admin', 'Legacy Admin', 'legacy-admin@integration.invalid', 'not-a-login-hash', 'ADMIN', true, CURRENT_TIMESTAMP),
  ('legacy_user_sales', 'Legacy Sales', 'legacy-sales@integration.invalid', 'not-a-login-hash', 'SALES', false, CURRENT_TIMESTAMP);

INSERT INTO "SharedBusinessRecord" (
  "id", "entityType", "displayName", "status", "sourceApp", "externalKey", "searchText", "data", "updatedAt"
) VALUES (
  'legacy_SharedBusinessRecord', 'LEAD', 'Legacy shared lead', 'ACTIVE', 'legacy-test',
  'legacy-shared-key', 'legacy shared lead', '{}'::jsonb, CURRENT_TIMESTAMP
);
INSERT INTO "SharedBusinessRecordVersion" (
  "id", "recordId", "versionNumber", "entityType", "sourceApp", "changeType", "snapshot"
) VALUES (
  'legacy_SharedBusinessRecordVersion', 'legacy_SharedBusinessRecord', 1, 'LEAD', 'legacy-test', 'CREATE', '{}'::jsonb
);
INSERT INTO "SharedRecordExportSnapshot" ("id", "itemCount", "expiresAt") VALUES
  ('legacy_SharedRecordExportSnapshot', 1, CURRENT_TIMESTAMP + INTERVAL '1 day');
INSERT INTO "SharedRecordExportSnapshotItem" ("snapshotId", "position", "payload") VALUES
  ('legacy_SharedRecordExportSnapshot', 1, '{}'::jsonb);
INSERT INTO "WorkflowEvent" (
  "id", "sourceApp", "sourceEventId", "sourceEventType", "entityType", "summary", "payload", "updatedAt"
) VALUES (
  'legacy_WorkflowEvent', 'legacy-test', 'legacy-event-1', 'LEGACY_CREATED', 'LEAD', 'Legacy event', '{}'::jsonb, CURRENT_TIMESTAMP
);

INSERT INTO "LeadCustomer" (
  "id", "name", "ownerId", "createdById", "updatedById", "updatedAt"
) VALUES (
  'legacy_LeadCustomer', 'Legacy Customer', 'legacy_user_sales', 'legacy_user_admin', 'legacy_user_admin', CURRENT_TIMESTAMP
);
INSERT INTO "Branch" ("id", "leadCustomerId", "name", "updatedAt") VALUES
  ('legacy_Branch', 'legacy_LeadCustomer', 'Legacy Branch', CURRENT_TIMESTAMP);
INSERT INTO "Contact" ("id", "leadCustomerId", "branchId", "name", "updatedAt") VALUES
  ('legacy_Contact', 'legacy_LeadCustomer', 'legacy_Branch', 'Legacy Contact', CURRENT_TIMESTAMP);
INSERT INTO "Activity" (
  "id", "leadCustomerId", "branchId", "contactId", "ownerId", "createdById", "type", "subject", "updatedAt"
) VALUES (
  'legacy_Activity', 'legacy_LeadCustomer', 'legacy_Branch', 'legacy_Contact', 'legacy_user_sales',
  'legacy_user_admin', 'CALL', 'Legacy activity', CURRENT_TIMESTAMP
);
INSERT INTO "LeadOwnershipHistory" (
  "id", "leadCustomerId", "toOwnerId", "changedById", "reason"
) VALUES (
  'legacy_LeadOwnershipHistory', 'legacy_LeadCustomer', 'legacy_user_sales', 'legacy_user_admin', 'Legacy assignment'
);

INSERT INTO "PipelineStage" ("id", "name", "sortOrder", "updatedAt") VALUES
  ('legacy_PipelineStage', 'Legacy Stage', 999, CURRENT_TIMESTAMP);
INSERT INTO "Opportunity" (
  "id", "leadCustomerId", "branchId", "stageId", "ownerId", "title", "createdById", "updatedById", "updatedAt"
) VALUES (
  'legacy_Opportunity', 'legacy_LeadCustomer', 'legacy_Branch', 'legacy_PipelineStage', 'legacy_user_sales',
  'Legacy Opportunity', 'legacy_user_admin', 'legacy_user_admin', CURRENT_TIMESTAMP
);
INSERT INTO "OpportunityOwnerSplit" ("opportunityId", "userId", "percent") VALUES
  ('legacy_Opportunity', 'legacy_user_sales', 100);
INSERT INTO "SalesTarget" (
  "id", "ownerId", "financialYear", "quarter", "targetValueInr", "createdById", "updatedAt"
) VALUES (
  'legacy_SalesTarget', 'legacy_user_sales', 2099, 1, 1000.00, 'legacy_user_admin', CURRENT_TIMESTAMP
);

INSERT INTO "ProductService" (
  "id", "name", "code", "category", "createdById", "updatedById", "updatedAt"
) VALUES (
  'legacy_ProductService', 'Legacy Product', 'LEGACY-PRODUCT', 'Legacy', 'legacy_user_admin', 'legacy_user_admin', CURRENT_TIMESTAMP
);
INSERT INTO "Proposal" (
  "id", "opportunityId", "title", "sequenceNumber", "createdById", "updatedById", "updatedAt"
) VALUES (
  'legacy_Proposal', 'legacy_Opportunity', 'Legacy Proposal', 1, 'legacy_user_admin', 'legacy_user_admin', CURRENT_TIMESTAMP
);
INSERT INTO "ProposalLineItem" (
  "id", "proposalId", "productServiceId", "productNameSnapshot", "productCategorySnapshot",
  "quantity", "unitPricePaisa", "gstRateBps", "lineSubtotalPaisa", "lineGstPaisa", "lineTotalPaisa", "updatedAt"
) VALUES (
  'legacy_ProposalLineItem', 'legacy_Proposal', 'legacy_ProductService', 'Legacy Product', 'Legacy',
  1, 1000, 1800, 1000, 180, 1180, CURRENT_TIMESTAMP
);
INSERT INTO "ProposalPdfAttachment" (
  "id", "proposalId", "originalFileName", "storedFileName", "storageProvider", "storageKey",
  "mimeType", "fileSizeBytes", "uploadedById"
) VALUES (
  'legacy_ProposalPdfAttachment', 'legacy_Proposal', 'legacy.pdf', 'legacy.pdf', 'integration-test',
  'legacy/proposal.pdf', 'application/pdf', 100, 'legacy_user_admin'
);

INSERT INTO "Order" (
  "id", "orderNumber", "proposalId", "opportunityId", "leadCustomerId", "branchId", "ownerId",
  "subtotalPaisa", "gstPaisa", "totalPaisa", "createdById", "updatedById", "updatedAt"
) VALUES (
  'legacy_Order', 'LEGACY-ORDER-1', 'legacy_Proposal', 'legacy_Opportunity', 'legacy_LeadCustomer',
  'legacy_Branch', 'legacy_user_sales', 1000, 180, 1180, 'legacy_user_admin', 'legacy_user_admin', CURRENT_TIMESTAMP
);
INSERT INTO "OrderLineItem" (
  "id", "orderId", "proposalLineItemId", "productServiceId", "productNameSnapshot", "productCategorySnapshot",
  "quantity", "unitPricePaisa", "gstRateBps", "lineSubtotalPaisa", "lineGstPaisa", "lineTotalPaisa", "updatedAt"
) VALUES (
  'legacy_OrderLineItem', 'legacy_Order', 'legacy_ProposalLineItem', 'legacy_ProductService', 'Legacy Product', 'Legacy',
  1, 1000, 1800, 1000, 180, 1180, CURRENT_TIMESTAMP
);
INSERT INTO "OrderOwnerSplitSnapshot" ("orderId", "userId", "percent") VALUES
  ('legacy_Order', 'legacy_user_sales', 100);

INSERT INTO "ProductionTemplate" ("id", "key", "name", "updatedAt") VALUES
  ('legacy_ProductionTemplate', 'legacy-template', 'Legacy Template', CURRENT_TIMESTAMP);
INSERT INTO "ProductionTemplateStage" (
  "id", "templateId", "key", "name", "updatedAt"
) VALUES (
  'legacy_ProductionTemplateStage', 'legacy_ProductionTemplate', 'legacy-stage', 'Legacy Stage', CURRENT_TIMESTAMP
);
INSERT INTO "ProductionWorkItem" (
  "id", "orderLineItemId", "productionTemplateId", "title", "productNameSnapshot", "productCategorySnapshot",
  "createdById", "updatedById", "updatedAt"
) VALUES (
  'legacy_ProductionWorkItem', 'legacy_OrderLineItem', 'legacy_ProductionTemplate', 'Legacy Work',
  'Legacy Product', 'Legacy', 'legacy_user_admin', 'legacy_user_admin', CURRENT_TIMESTAMP
);
INSERT INTO "ProductionStageInstance" (
  "id", "workItemId", "templateStageId", "name", "updatedAt"
) VALUES (
  'legacy_ProductionStageInstance', 'legacy_ProductionWorkItem', 'legacy_ProductionTemplateStage', 'Legacy Stage', CURRENT_TIMESTAMP
);
INSERT INTO "ProductionNote" ("id", "workItemId", "stageInstanceId", "body", "createdById") VALUES
  ('legacy_ProductionNote', 'legacy_ProductionWorkItem', 'legacy_ProductionStageInstance', 'Legacy note', 'legacy_user_admin');

INSERT INTO "Invoice" (
  "id", "orderId", "invoiceNumber", "invoiceDate", "subtotalPaisa", "gstPaisa", "totalPaisa",
  "createdById", "updatedById", "updatedAt"
) VALUES (
  'legacy_Invoice', 'legacy_Order', 'LEGACY-INVOICE-1', CURRENT_TIMESTAMP, 1000, 180, 1180,
  'legacy_user_admin', 'legacy_user_admin', CURRENT_TIMESTAMP
);
INSERT INTO "Payment" (
  "id", "orderId", "paymentDate", "amountPaisa", "mode", "createdById", "updatedAt"
) VALUES (
  'legacy_Payment', 'legacy_Order', CURRENT_TIMESTAMP, 1180, 'BANK_TRANSFER', 'legacy_user_admin', CURRENT_TIMESTAMP
);
INSERT INTO "PaymentAllocation" ("id", "paymentId", "invoiceId", "amountPaisa") VALUES
  ('legacy_PaymentAllocation', 'legacy_Payment', 'legacy_Invoice', 1180);
INSERT INTO "CostComponent" (
  "id", "orderId", "orderLineItemId", "category", "description", "amountPaisa",
  "createdById", "updatedById", "updatedAt"
) VALUES (
  'legacy_CostComponent', 'legacy_Order', 'legacy_OrderLineItem', 'Legacy', 'Legacy cost', 100,
  'legacy_user_admin', 'legacy_user_admin', CURRENT_TIMESTAMP
);
INSERT INTO "Incentive" (
  "id", "orderId", "grossMarginPaisa", "approvedCostTotalPaisa", "calculatedAmountPaisa",
  "payableAmountPaisa", "updatedAt"
) VALUES (
  'legacy_Incentive', 'legacy_Order', 1080, 100, 54, 54, CURRENT_TIMESTAMP
);
INSERT INTO "IncentiveSplit" ("incentiveId", "userId", "percent", "amountPaisa") VALUES
  ('legacy_Incentive', 'legacy_user_sales', 100, 54);

INSERT INTO "SalesTask" (
  "id", "ownerId", "leadCustomerId", "opportunityId", "proposalId", "orderId", "title", "type", "updatedAt"
) VALUES (
  'legacy_SalesTask', 'legacy_user_sales', 'legacy_LeadCustomer', 'legacy_Opportunity', 'legacy_Proposal',
  'legacy_Order', 'Legacy task', 'CALL', CURRENT_TIMESTAMP
);
INSERT INTO "SalesTextNote" (
  "id", "ownerId", "taskId", "leadCustomerId", "opportunityId", "proposalId", "orderId", "body", "updatedAt"
) VALUES (
  'legacy_SalesTextNote', 'legacy_user_sales', 'legacy_SalesTask', 'legacy_LeadCustomer', 'legacy_Opportunity',
  'legacy_Proposal', 'legacy_Order', 'Legacy text note', CURRENT_TIMESTAMP
);
INSERT INTO "SalesVoiceNote" (
  "id", "ownerId", "taskId", "leadCustomerId", "opportunityId", "proposalId", "orderId",
  "audioStorageKey", "originalFileName", "mimeType", "fileSizeBytes", "updatedAt"
) VALUES (
  'legacy_SalesVoiceNote', 'legacy_user_sales', 'legacy_SalesTask', 'legacy_LeadCustomer', 'legacy_Opportunity',
  'legacy_Proposal', 'legacy_Order', 'legacy/audio.webm', 'audio.webm', 'audio/webm', 100, CURRENT_TIMESTAMP
);
INSERT INTO "SalesVoiceNoteAction" ("id", "voiceNoteId", "createdTaskId", "title", "type") VALUES
  ('legacy_SalesVoiceNoteAction', 'legacy_SalesVoiceNote', 'legacy_SalesTask', 'Legacy voice action', 'CALL');
INSERT INTO "SalesDayReview" ("id", "ownerId", "reviewDate", "updatedAt") VALUES
  ('legacy_SalesDayReview', 'legacy_user_sales', DATE '2099-01-01', CURRENT_TIMESTAMP);
INSERT INTO "SalesDayReviewItem" ("id", "reviewId", "taskId", "status") VALUES
  ('legacy_SalesDayReviewItem', 'legacy_SalesDayReview', 'legacy_SalesTask', 'DONE');

COMMIT;
`;

function legacyFixturePredicate(tableName: (typeof tenantOwnedModels)[number]) {
  switch (tableName) {
    case "SharedRecordExportSnapshotItem":
      return `"snapshotId" = 'legacy_SharedRecordExportSnapshot' AND "position" = 1`;
    case "OpportunityOwnerSplit":
      return `"opportunityId" = 'legacy_Opportunity' AND "userId" = 'legacy_user_sales'`;
    case "OrderOwnerSplitSnapshot":
      return `"orderId" = 'legacy_Order' AND "userId" = 'legacy_user_sales'`;
    case "IncentiveSplit":
      return `"incentiveId" = 'legacy_Incentive' AND "userId" = 'legacy_user_sales'`;
    default:
      return `"id" = 'legacy_${tableName}'`;
  }
}

async function readLegacyFixtureCounts(client: PrismaClient, includeOwnership: boolean) {
  const query = tenantOwnedModels
    .map((tableName) => {
      const ownership = includeOwnership
        ? `, COUNT(*) FILTER (WHERE "organizationId" = (SELECT "id" FROM "Organization" WHERE "key" = 'ara-global'))::integer AS "ownedCount"`
        : "";
      return `SELECT '${tableName}' AS "tableName", COUNT(*)::integer AS "rowCount"${ownership} FROM ${quoteIdentifier(tableName)} WHERE ${legacyFixturePredicate(tableName)}`;
    })
    .join(" UNION ALL ");
  return client.$queryRawUnsafe<Array<{ ownedCount?: number; rowCount: number; tableName: string }>>(
    `${query} ORDER BY "tableName"`
  );
}

integrationDescribe("organization tenancy PostgreSQL integration", () => {
  let client: PrismaClient;
  let databaseIdentity: ReturnType<typeof validateIntegrationDatabaseUrl>;
  let firstSeedFingerprint: Awaited<ReturnType<typeof readSeedFingerprint>>;
  let ownershipBeforeBackfill: OwnershipCount[];
  let temporaryPrismaRoot: string;
  let preWp2SchemaPath: string;

  beforeAll(async () => {
    if (!integrationDatabaseUrl) {
      throw new Error("ECRM_TENANCY_TEST_DATABASE_URL is required for integration mode");
    }

    databaseIdentity = validateIntegrationDatabaseUrl(integrationDatabaseUrl, process.env.DATABASE_URL);
    client = new PrismaClient({ datasources: { db: { url: integrationDatabaseUrl } } });

    const [actualDatabase] = await client.$queryRawUnsafe<
      Array<{ databaseName: string; port: number; schemaName: string; targetTableCount: number }>
    >(`
      SELECT
        current_database() AS "databaseName",
        inet_server_port() AS "port",
        current_schema() AS "schemaName",
        (SELECT COUNT(*)::integer FROM pg_tables WHERE schemaname = current_schema()) AS "targetTableCount"
    `);

    expect(actualDatabase).toEqual({
      databaseName: databaseIdentity.databaseName,
      port: Number(databaseIdentity.port),
      schemaName: databaseIdentity.schema,
      targetTableCount: 0
    });

    const temporaryPrisma = createPreWp2PrismaRoot();
    temporaryPrismaRoot = temporaryPrisma.root;
    preWp2SchemaPath = temporaryPrisma.schemaPath;
    runPrismaCommandSuccessfully(
      ["prisma", "migrate", "deploy", "--schema", preWp2SchemaPath],
      integrationDatabaseUrl
    );
  }, 120_000);

  afterAll(async () => {
    await client?.$disconnect();
    if (temporaryPrismaRoot) {
      rmSync(temporaryPrismaRoot, { force: true, recursive: true });
    }
  });

  test(
    "applies only the pre-WP2 chain and populates 38 of 38 owned tables",
    async () => {
      const expectedPreWp2MigrationCount = readdirSync(join(prismaRoot, "migrations"), {
        withFileTypes: true
      }).filter(
        (entry) =>
          entry.isDirectory() &&
          entry.name < "20260809120000_" &&
          existsSync(join(prismaRoot, "migrations", entry.name, "migration.sql"))
      ).length;
      const [migrationState] = await client.$queryRawUnsafe<
        Array<{ appliedCount: number; failedCount: number }>
      >(`
        SELECT
          COUNT(*) FILTER (WHERE finished_at IS NOT NULL)::integer AS "appliedCount",
          COUNT(*) FILTER (WHERE finished_at IS NULL)::integer AS "failedCount"
        FROM "_prisma_migrations"
      `);

      expect(migrationState).toEqual({
        appliedCount: expectedPreWp2MigrationCount,
        failedCount: 0
      });
      runPrismaCommandSuccessfully(
        ["prisma", "db", "execute", "--stdin", "--schema", preWp2SchemaPath],
        integrationDatabaseUrl!,
        legacyFixtureSql
      );

      const legacyCounts = await readLegacyFixtureCounts(client, false);
      expect(legacyCounts).toHaveLength(tenantOwnedModels.length);
      expect(legacyCounts.map(({ tableName }) => tableName)).toEqual([...tenantOwnedModels].sort());
      expect(legacyCounts.reduce((total, row) => total + row.rowCount, 0)).toBe(38);
      for (const row of legacyCounts) {
        expect(row.rowCount, `${row.tableName} must have a legacy fixture before WP2`).toBe(1);
      }
    },
    120_000
  );

  test(
    "applies WP2 to the populated legacy database and reconciles 38 of 38 tables",
    async () => {
      runPrismaCommandSuccessfully(["prisma", "migrate", "deploy"], integrationDatabaseUrl!);

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

      const legacyCounts = await readLegacyFixtureCounts(client, true);
      expect(legacyCounts).toHaveLength(38);
      for (const row of legacyCounts) {
        expect(row.rowCount, row.tableName).toBe(1);
        expect(row.ownedCount, row.tableName).toBe(1);
      }

      const reconciliation = await readReconciliation(client);
      expect(reconciliation).toHaveLength(38);
      expect(reconciliation.reduce((total, row) => total + row.beforeCount, 0)).toBe(38);
      expect(reconciliation.reduce((total, row) => total + row.afterCount, 0)).toBe(38);
      for (const row of reconciliation) {
        expect(row.afterCount, row.tableName).toBe(row.beforeCount);
        expect(row.nullCount, row.tableName).toBe(0);
        expect(row.mismatchCount, row.tableName).toBe(0);
      }

      const sharedIndexes = await client.$queryRawUnsafe<Array<{ indexname: string }>>(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'SharedBusinessRecord'
          AND indexname IN (
            'SharedBusinessRecord_entityType_externalKey_key',
            'SharedBusinessRecord_organizationId_entityType_externalKey_key'
          )
          AND indexdef LIKE 'CREATE UNIQUE INDEX%'
        ORDER BY indexname
      `);
      expect(sharedIndexes.map(({ indexname }) => indexname)).toEqual([
        "SharedBusinessRecord_entityType_externalKey_key",
        "SharedBusinessRecord_organizationId_entityType_externalKey_key"
      ]);
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
    expect(memberships).toEqual([
      {
        active: true,
        legacyRole: "ADMIN",
        membershipRole: "ADMIN",
        membershipStatus: "ACTIVE",
        userId: "legacy_user_admin"
      },
      {
        active: false,
        legacyRole: "SALES",
        membershipRole: "SALES",
        membershipStatus: "SUSPENDED",
        userId: "legacy_user_sales"
      }
    ]);
  });

  test(
    "replay preserves organization lifecycle, membership state, and tenant configuration",
    async () => {
      await client.$executeRawUnsafe(`
        UPDATE "Organization"
        SET "status" = 'OFFBOARDING', "deploymentRegion" = 'custom-preserved-region'
        WHERE "key" = 'ara-global'
      `);
      await client.$executeRawUnsafe(`
        UPDATE "OrganizationSettings"
        SET "locale" = 'en-GB', "timezone" = 'Europe/London', "operationalLimits" = '{"preserved":true}'::jsonb
        WHERE "organizationId" = (SELECT "id" FROM "Organization" WHERE "key" = 'ara-global')
      `);
      await client.$executeRawUnsafe(`
        UPDATE "OrganizationBranding"
        SET "productName" = 'Preserved Product', "primaryColor" = '#123456'
        WHERE "organizationId" = (SELECT "id" FROM "Organization" WHERE "key" = 'ara-global')
      `);
      await client.$executeRawUnsafe(`
        UPDATE "OrganizationMembership"
        SET "role" = 'OWNER', "status" = 'REVOKED'
        WHERE "organizationId" = (SELECT "id" FROM "Organization" WHERE "key" = 'ara-global')
          AND "userId" = 'legacy_user_admin'
      `);
      await client.$executeRawUnsafe(`
        UPDATE "OrganizationMembership"
        SET "role" = 'READ_ONLY', "status" = 'INVITED'
        WHERE "organizationId" = (SELECT "id" FROM "Organization" WHERE "key" = 'ara-global')
          AND "userId" = 'legacy_user_sales'
      `);

      const readOperationalState = () =>
        client.$queryRawUnsafe<
          Array<{
            adminRole: string;
            adminStatus: string;
            config: unknown;
            deploymentRegion: string;
            locale: string;
            primaryColor: string;
            productName: string;
            salesRole: string;
            salesStatus: string;
            status: string;
            timezone: string;
          }>
        >(`
          SELECT
            o."status"::text AS "status",
            o."deploymentRegion",
            s."locale",
            s."timezone",
            s."operationalLimits" AS "config",
            b."productName",
            b."primaryColor",
            admin_membership."role"::text AS "adminRole",
            admin_membership."status"::text AS "adminStatus",
            sales_membership."role"::text AS "salesRole",
            sales_membership."status"::text AS "salesStatus"
          FROM "Organization" o
          JOIN "OrganizationSettings" s ON s."organizationId" = o."id"
          JOIN "OrganizationBranding" b ON b."organizationId" = o."id"
          JOIN "OrganizationMembership" admin_membership
            ON admin_membership."organizationId" = o."id" AND admin_membership."userId" = 'legacy_user_admin'
          JOIN "OrganizationMembership" sales_membership
            ON sales_membership."organizationId" = o."id" AND sales_membership."userId" = 'legacy_user_sales'
          WHERE o."key" = 'ara-global'
        `);

      const stateBeforeReplay = await readOperationalState();
      runTenancySqlSuccessfully(integrationDatabaseUrl!);
      expect(await readOperationalState()).toEqual(stateBeforeReplay);
      expect(stateBeforeReplay).toEqual([
        {
          adminRole: "OWNER",
          adminStatus: "REVOKED",
          config: { preserved: true },
          deploymentRegion: "custom-preserved-region",
          locale: "en-GB",
          primaryColor: "#123456",
          productName: "Preserved Product",
          salesRole: "READ_ONLY",
          salesStatus: "INVITED",
          status: "OFFBOARDING",
          timezone: "Europe/London"
        }
      ]);
    },
    120_000
  );

  test(
    "executes the current reset-and-seed behavior after proving the legacy upgrade",
    async () => {
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
    180_000
  );

  test(
    "executes the tenancy SQL a second time without changing counts or reconciliation",
    async () => {
      const countsBefore = await readOwnershipCounts(client);
      const reconciliationBefore = await readReconciliation(client);
      runFullTenancySqlSuccessfully(integrationDatabaseUrl!);
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
    "aborts with the mismatch gate for a non-null orphaned parent reference",
    async () => {
      await client.$executeRawUnsafe(`
        INSERT INTO "SharedBusinessRecord" (
          "id", "entityType", "displayName", "status", "sourceApp", "searchText", "data",
          "parentId", "organizationId", "updatedAt"
        ) VALUES (
          'integration_nonnull_orphan_shared', 'LEAD', 'Integration orphan', 'ACTIVE',
          'integration-test', 'integration orphan', '{}'::jsonb,
          'integration_missing_shared_parent',
          (SELECT "id" FROM "Organization" WHERE "key" = 'ara-global'), CURRENT_TIMESTAMP
        )
      `);

      try {
        const result = runTenancySql(integrationDatabaseUrl!);
        expect(result.status).not.toBe(0);
        expect(result.output).toMatch(
          /Organization tenancy backfill mismatch: 1 parent\/child organization relationships disagree/
        );
      } finally {
        await client.$executeRawUnsafe(`
          DELETE FROM "SharedBusinessRecord" WHERE "id" = 'integration_nonnull_orphan_shared'
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
