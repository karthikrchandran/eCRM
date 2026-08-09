import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

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
    expect(organization).toMatch(/\bkey\s+String\s+@unique\b/);
    expect(organization).toMatch(/\blegalName\s+String\b/);
    expect(organization).toMatch(/\bdisplayName\s+String\b/);
    expect(organization).toMatch(/\bstatus\s+OrganizationStatus\s+@default\(PROVISIONING\)/);
    expect(organization).toMatch(/\bdeploymentRegion\s+String\b/);
    expect(organization).toMatch(/\bversion\s+Int\s+@default\(1\)/);

    for (const modelName of ["OrganizationMembership", "OrganizationSettings", "OrganizationBranding"]) {
      const model = block(schema, "model", modelName);
      expect(model).toMatch(/\borganizationId\s+String\b/);
      expect(model).toMatch(/\borganization\s+Organization\s+@relation/);
    }

    const membership = block(schema, "model", "OrganizationMembership");
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
