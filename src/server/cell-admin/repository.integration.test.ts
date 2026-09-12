// @vitest-environment node
import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaCellAdministrationRepository } from "./repository";
import type { CellAuditEventRecord, CellConfigurationRecord } from "./service";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://ecrm:ecrm@localhost:54329/ecrm?schema=public";
const schemaName = `cell_revision_${randomUUID().replaceAll("-", "")}`;
let admin: PrismaClient;
let client: PrismaClient;

describe("Prisma cell administration revision-zero migration regression", () => {
  beforeAll(async () => {
    admin = new PrismaClient({ datasourceUrl: databaseUrl });
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
    const scopedUrl = new URL(databaseUrl!);
    scopedUrl.searchParams.set("schema", schemaName);
    client = new PrismaClient({ datasourceUrl: scopedUrl.toString() });
    await client.$executeRawUnsafe(`CREATE TYPE "CurrencyCode" AS ENUM ('INR', 'USD')`);
    await client.$executeRawUnsafe(`
      CREATE TABLE "CellConfiguration" (
        "id" TEXT PRIMARY KEY, "displayName" TEXT NOT NULL, "logoUrl" TEXT, "supportUrl" TEXT,
        "legalUrl" TEXT, "primaryColor" TEXT NOT NULL, "locale" TEXT NOT NULL, "timezone" TEXT NOT NULL,
        "defaultCurrency" "CurrencyCode" NOT NULL, "enabledModules" TEXT[] NOT NULL,
        "allowedModules" TEXT[] NOT NULL, "planCode" TEXT NOT NULL, "revision" INTEGER NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.$executeRawUnsafe(`
      CREATE TABLE "CellAuditEvent" (
        "id" TEXT PRIMARY KEY, "actorId" TEXT NOT NULL, "action" TEXT NOT NULL,
        "targetType" TEXT NOT NULL, "targetId" TEXT NOT NULL, "correlationId" TEXT NOT NULL,
        "reason" TEXT NOT NULL, "before" JSONB, "after" JSONB, "result" TEXT NOT NULL,
        "error" TEXT, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  afterAll(async () => {
    await client?.$disconnect();
    if (admin) {
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await admin.$disconnect();
    }
  });

  it("conditionally updates a migrated revision-zero singleton on its first write", async () => {
    await client.cellConfiguration.create({ data: configuration(0) });
    const repository = new PrismaCellAdministrationRepository(client);
    const result = await repository.updateConfigurationWithAudit(configuration(1), 0, audit);

    expect(result).toMatchObject({ revision: 1, defaultCurrency: "USD" });
    await expect(client.cellAuditEvent.count({ where: { correlationId: audit.correlationId } })).resolves.toBe(1);
  });
});

const audit: CellAuditEventRecord = {
  id: "audit_revision_zero", actorId: "admin_1", action: "cell-configuration.update",
  targetType: "CellConfiguration", targetId: "default", correlationId: "corr_revision_zero",
  reason: "First write after migration", before: { revision: 0 }, after: { revision: 1 },
  result: "SUCCEEDED", occurredAt: new Date("2026-08-11T20:00:00Z")
};

function configuration(revision: number): CellConfigurationRecord {
  return {
    id: "default", displayName: "eCRM", logoUrl: null, supportUrl: null, legalUrl: null,
    primaryColor: "#1e3a5f", locale: "en-US", timezone: "UTC",
    defaultCurrency: revision === 0 ? "INR" : "USD", enabledModules: ["crm"],
    allowedModules: ["crm"], planCode: "ENTERPRISE", revision,
    createdAt: new Date("2026-08-11T12:00:00Z"), updatedAt: new Date("2026-08-11T12:00:00Z")
  };
}
