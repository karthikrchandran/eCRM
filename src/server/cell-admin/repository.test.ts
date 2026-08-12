import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { PrismaCellAdministrationRepository } from "./repository";
import type { CellAuditEventRecord, CellConfigurationRecord } from "./service";

const original = configuration("INR");
const updated = configuration("USD");
const audit: CellAuditEventRecord = {
  id: "audit_currency",
  actorId: "admin_1",
  action: "cell-configuration.update",
  targetType: "CellConfiguration",
  targetId: "default",
  correlationId: "corr_currency",
  reason: "Set commercial currency",
  before: { defaultCurrency: "INR" },
  after: { defaultCurrency: "USD" },
  result: "SUCCEEDED",
  occurredAt: new Date("2026-08-11T20:00:00Z")
};

describe("Prisma cell administration repository", () => {
  it("commits a currency change and its audit event in one transaction", async () => {
    const durable = { configuration: original, audits: [] as CellAuditEventRecord[] };
    const repository = new PrismaCellAdministrationRepository(transactionalClient(durable));

    await repository.updateConfigurationWithAudit(updated, audit);

    expect(durable.configuration.defaultCurrency).toBe("USD");
    expect(durable.audits).toEqual([audit]);
  });

  it("rolls back the currency change when the audit insert fails", async () => {
    const durable = { configuration: original, audits: [] as CellAuditEventRecord[] };
    const repository = new PrismaCellAdministrationRepository(transactionalClient(durable, true));

    await expect(repository.updateConfigurationWithAudit(updated, audit)).rejects.toThrow("audit insert failed");

    expect(durable.configuration.defaultCurrency).toBe("INR");
    expect(durable.audits).toEqual([]);
  });
});

function transactionalClient(
  durable: { configuration: CellConfigurationRecord; audits: CellAuditEventRecord[] },
  failAudit = false
) {
  return {
    $transaction: async (operation: (transaction: unknown) => Promise<unknown>) => {
      let pendingConfiguration = durable.configuration;
      const pendingAudits = [...durable.audits];
      const transaction = {
        cellConfiguration: {
          upsert: async () => {
            pendingConfiguration = updated;
            return updated;
          }
        },
        cellAuditEvent: {
          create: async ({ data }: { data: CellAuditEventRecord }) => {
            if (failAudit) throw new Error("audit insert failed");
            pendingAudits.push(data);
            return data;
          }
        }
      };
      const result = await operation(transaction);
      durable.configuration = pendingConfiguration;
      durable.audits = pendingAudits;
      return result;
    }
  } as unknown as PrismaClient;
}

function configuration(defaultCurrency: "INR" | "USD"): CellConfigurationRecord {
  return {
    id: "default",
    displayName: "eCRM",
    logoUrl: null,
    primaryColor: "#1e3a5f",
    locale: "en-US",
    timezone: "UTC",
    defaultCurrency,
    enabledModules: ["crm"],
    allowedModules: ["crm"],
    planCode: "ENTERPRISE",
    createdAt: new Date("2026-08-11T12:00:00Z"),
    updatedAt: new Date("2026-08-11T12:00:00Z")
  };
}
