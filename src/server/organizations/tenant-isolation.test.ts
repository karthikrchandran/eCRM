import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { listSharedRecords, getSharedRecord } from "@/server/shared-records/queries";
import { ingestWorkflowEvent } from "@/server/workflow-events/service";
import { withOrganization } from "./with-organization";

const ownedModels = [
  "SharedBusinessRecord", "SharedBusinessRecordVersion", "SharedRecordExportSnapshot",
  "SharedRecordExportSnapshotItem", "WorkflowEvent", "LeadCustomer", "Branch", "Contact",
  "Activity", "LeadOwnershipHistory", "SalesTask", "SalesTextNote", "SalesVoiceNote",
  "SalesVoiceNoteAction", "SalesDayReview", "SalesDayReviewItem", "PipelineStage",
  "Opportunity", "OpportunityOwnerSplit", "SalesTarget", "ProductService", "Proposal",
  "ProposalLineItem", "ProposalPdfAttachment", "Order", "OrderLineItem",
  "OrderOwnerSplitSnapshot", "ProductionTemplate", "ProductionTemplateStage",
  "ProductionWorkItem", "ProductionStageInstance", "ProductionNote", "Invoice", "Payment",
  "PaymentAllocation", "CostComponent", "Incentive", "IncentiveSplit"
] as const;

describe("withOrganization", () => {
  it("rejects a blank organization before opening a transaction", async () => {
    const transaction = vi.fn();

    await expect(withOrganization("  ", vi.fn(), { $transaction: transaction } as never))
      .rejects.toThrow("Organization context is required.");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("sets transaction-local tenant state and gives work the same transaction client", async () => {
    const tx = { $executeRaw: vi.fn().mockResolvedValue(1) };
    const database = {
      $transaction: vi.fn(async (work: (client: typeof tx) => Promise<string>) => work(tx))
    };
    const work = vi.fn(async (client: typeof tx) => client === tx ? "same-client" : "wrong-client");

    await expect(withOrganization("org_A", work as never, database as never)).resolves.toBe("same-client");
    expect(database.$transaction).toHaveBeenCalledOnce();
    expect(tx.$executeRaw).toHaveBeenCalledOnce();
    expect(work).toHaveBeenCalledWith(tx);

    const sqlCall = tx.$executeRaw.mock.calls[0];
    expect(sqlCall[0]).toEqual(["SELECT set_config('app.organization_id', ", ", true)"]);
    expect(sqlCall[1]).toBe("org_A");
  });
});

describe("tenant contract migration", () => {
  const migrationPath = join(
    process.cwd(),
    "prisma/migrations/20260809120043_contract_organization_isolation/migration.sql"
  );

  it("makes every owned organizationId non-null and forces RLS with read/write policies", () => {
    const sql = readFileSync(migrationPath, "utf8");
    const executableSql = sql
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");
    const policyLoop = [...executableSql.matchAll(/FOREACH tenant_table[\s\S]+?END LOOP;/g)]
      .find((match) => match[0].includes("CREATE POLICY"))?.[0] ?? "";

    for (const model of ownedModels) {
      expect(executableSql, `${model} NOT NULL`).toContain(
        `ALTER TABLE "${model}" ALTER COLUMN "organizationId" SET NOT NULL`
      );
      expect(executableSql, `${model} RLS enabled`).toContain(`ALTER TABLE "${model}" ENABLE ROW LEVEL SECURITY`);
      expect(executableSql, `${model} RLS forced`).toContain(`ALTER TABLE "${model}" FORCE ROW LEVEL SECURITY`);
      expect(policyLoop, `${model} executable policy inventory`).toContain(`'${model}'`);
    }

    expect(policyLoop).toContain("current_setting(''app.organization_id'', true)");
    expect(policyLoop).toContain("USING (");
    expect(policyLoop).toContain("WITH CHECK (");
  });
});

describe("tenant database role operation", () => {
  const roleOperationPath = join(
    process.cwd(),
    "prisma/operations/configure-tenant-app-role.sql"
  );

  it("keeps privileges in a NOLOGIN role and grants it to an external LOGIN principal", () => {
    const sql = readFileSync(roleOperationPath, "utf8");

    expect(sql).toContain("app_role is required");
    expect(sql).toContain("login_role is required");
    expect(sql).toMatch(/CREATE ROLE %I NOLOGIN/);
    expect(sql).toContain("rolcanlogin");
    expect(sql).toContain("GRANT %I TO %I");
    expect(sql).not.toMatch(/PASSWORD\s+/i);
  });

  it("prevents the tenant role from reading authentication and control-plane tables", () => {
    const sql = readFileSync(roleOperationPath, "utf8");

    expect(sql).toContain(
      'REVOKE ALL PRIVILEGES ON TABLE "User", "Organization", "OrganizationMembership", "OrganizationSettings", "OrganizationBranding"'
    );
  });
});

describe("shared integration isolation", () => {
  it("scopes list and direct-id reads to the authoritative organization", async () => {
    const database = {
      sharedBusinessRecord: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null)
      }
    };

    await listSharedRecords("org_A", {}, database as never);
    await getSharedRecord("org_A", "record_B", database as never);

    expect(database.sharedBusinessRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: "org_A" }) })
    );
    expect(database.sharedBusinessRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "record_B", organizationId: "org_A" }) })
    );
  });

  it("scopes workflow idempotency and rejects a related lead from another organization", async () => {
    const database = {
      workflowEvent: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn()
      },
      leadCustomer: {
        findFirst: vi.fn().mockResolvedValue(null)
      },
      salesTask: { create: vi.fn() }
    };

    await expect(ingestWorkflowEvent("org_A", {
      sourceApp: "emailvoice",
      sourceEventId: "same-id",
      sourceEventType: "meeting_booked",
      entityType: "ACTIVITY",
      relatedRecordType: "LEAD",
      relatedRecordId: "lead_B",
      summary: "same-shaped event"
    }, database as never)).rejects.toThrow("Related record was not found.");

    expect(database.workflowEvent.findFirst).toHaveBeenCalledWith({
      where: { organizationId: "org_A", sourceApp: "emailvoice", sourceEventId: "same-id" }
    });
    expect(database.leadCustomer.findFirst).toHaveBeenCalledWith({
      where: { id: "lead_B", organizationId: "org_A" },
      select: { id: true }
    });
    expect(database.workflowEvent.create).not.toHaveBeenCalled();
    expect(database.salesTask.create).not.toHaveBeenCalled();
  });
});
