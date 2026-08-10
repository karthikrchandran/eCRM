import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { assertTenantMember } from "@/server/organizations/tenant-member-guard";
import { withOrganization } from "@/server/organizations/with-organization";

export type WorkflowEventInput = {
  sourceApp: string;
  sourceEventId?: string | null;
  sourceEventType: string;
  entityType: string;
  entityId?: string | null;
  relatedRecordType?: string | null;
  relatedRecordId?: string | null;
  summary: string;
  payload?: Record<string, unknown>;
  occurredAt?: Date;
};

export type WorkflowEventRecord = {
  id: string;
  sourceApp: string;
  sourceEventId?: string | null;
  sourceEventType: string;
  entityType: string;
  entityId?: string | null;
  relatedRecordType?: string | null;
  relatedRecordId?: string | null;
  summary: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type WorkflowEventDb = {
  $queryRaw?<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  workflowEvent: {
    create: (args: Prisma.WorkflowEventCreateArgs) => Promise<WorkflowEventRecord>;
    findMany: (args: Prisma.WorkflowEventFindManyArgs) => Promise<WorkflowEventRecord[]>;
    findFirst?: (args: Prisma.WorkflowEventFindFirstArgs) => Promise<WorkflowEventRecord | null>;
  };
  leadCustomer?: {
    findFirst: (args: Prisma.LeadCustomerFindFirstArgs) => Promise<{ id: string } | null>;
  };
  activity?: { findFirst: (args: Prisma.ActivityFindFirstArgs) => Promise<{ id: string } | null> };
  contact?: { findFirst: (args: Prisma.ContactFindFirstArgs) => Promise<{ id: string } | null> };
  incentive?: { findFirst: (args: Prisma.IncentiveFindFirstArgs) => Promise<{ id: string } | null> };
  invoice?: { findFirst: (args: Prisma.InvoiceFindFirstArgs) => Promise<{ id: string } | null> };
  opportunity?: { findFirst: (args: Prisma.OpportunityFindFirstArgs) => Promise<{ id: string } | null> };
  order?: { findFirst: (args: Prisma.OrderFindFirstArgs) => Promise<{ id: string } | null> };
  productionWorkItem?: { findFirst: (args: Prisma.ProductionWorkItemFindFirstArgs) => Promise<{ id: string } | null> };
  proposal?: { findFirst: (args: Prisma.ProposalFindFirstArgs) => Promise<{ id: string } | null> };
  salesTask?: {
    create: (args: Prisma.SalesTaskCreateArgs) => Promise<{ id: string }>;
    findFirst?: (args: Prisma.SalesTaskFindFirstArgs) => Promise<{ id: string } | null>;
  };
};

function isLeadRelated(relatedRecordType?: string | null, relatedRecordId?: string | null) {
  return relatedRecordType === "LEAD" && Boolean(relatedRecordId);
}

async function validateWorkflowReference(
  organizationId: string,
  sourceApp: string,
  recordType: string,
  recordId: string,
  database: WorkflowEventDb
) {
  const where = { id: recordId, organizationId };
  let record: { id: string } | null | undefined;
  switch (recordType.trim().toUpperCase()) {
    case "LEAD":
    case "CUSTOMER": record = await database.leadCustomer?.findFirst({ where, select: { id: true } }); break;
    case "CONTACT": record = await database.contact?.findFirst({ where, select: { id: true } }); break;
    case "ACTIVITY": record = await database.activity?.findFirst({ where, select: { id: true } }); break;
    case "OPPORTUNITY": record = await database.opportunity?.findFirst({ where, select: { id: true } }); break;
    case "PROPOSAL": record = await database.proposal?.findFirst({ where, select: { id: true } }); break;
    case "ORDER": record = await database.order?.findFirst({ where, select: { id: true } }); break;
    case "INVOICE": record = await database.invoice?.findFirst({ where, select: { id: true } }); break;
    case "INCENTIVE": record = await database.incentive?.findFirst({ where, select: { id: true } }); break;
    case "PRODUCTION_WORK_ITEM": record = await database.productionWorkItem?.findFirst({ where, select: { id: true } }); break;
    case "SALES_TASK": record = await database.salesTask?.findFirst?.({ where, select: { id: true } }); break;
    default:
      if (!recordId.startsWith(`${sourceApp.trim().toLowerCase()}:`)) {
        throw new Error("External workflow identifiers must be source-namespaced.");
      }
      return;
  }
  if (!record) throw new Error("Related record was not found.");
}

export async function ingestWorkflowEvent(
  organizationId: string,
  input: WorkflowEventInput,
  database: WorkflowEventDb = db as unknown as WorkflowEventDb
): Promise<WorkflowEventRecord> {
  if (Boolean(input.relatedRecordType) !== Boolean(input.relatedRecordId)) {
    throw new Error("Workflow related record type and identifier must be provided together.");
  }
  if (database === (db as unknown as WorkflowEventDb)) {
    return withOrganization(organizationId, (tx) => ingestWorkflowEvent(organizationId, input, tx as unknown as WorkflowEventDb));
  }
  if (input.sourceEventId && database.workflowEvent.findFirst) {
    const existing = await database.workflowEvent.findFirst({
      where: { organizationId, sourceApp: input.sourceApp, sourceEventId: input.sourceEventId }
    });
    if (existing) return existing;
  }

  if (input.entityId) {
    await validateWorkflowReference(organizationId, input.sourceApp, input.entityType, input.entityId, database);
  }
  if (input.relatedRecordType && input.relatedRecordId) {
    await validateWorkflowReference(organizationId, input.sourceApp, input.relatedRecordType, input.relatedRecordId, database);
  }

  let relatedLead: { id: string } | null | undefined;
  if (isLeadRelated(input.relatedRecordType, input.relatedRecordId)) {
    relatedLead = await database.leadCustomer?.findFirst({
      where: { id: input.relatedRecordId!, organizationId },
      select: { id: true }
    });
    if (!relatedLead) {
      throw new Error("Related record was not found.");
    }

    if (input.sourceEventType === "meeting_booked") {
      const automationUserId = process.env.WORKFLOW_AUTOMATION_USER_ID?.trim();
      if (!automationUserId) throw new Error("Workflow automation actor is not configured.");
      if (!database.$queryRaw) throw new Error("Organization member was not found.");
      await assertTenantMember(database as Required<Pick<WorkflowEventDb, "$queryRaw">>, automationUserId, ["ADMIN", "SALES"]);
    }
  }

  const event = await database.workflowEvent.create({
    data: {
      organizationId,
      sourceApp: input.sourceApp,
      sourceEventId: input.sourceEventId ?? null,
      sourceEventType: input.sourceEventType,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      relatedRecordType: input.relatedRecordType ?? null,
      relatedRecordId: input.relatedRecordId ?? null,
      summary: input.summary,
      payload: (input.payload ?? {}) as Prisma.InputJsonValue,
      occurredAt: input.occurredAt ?? new Date()
    }
  });

  if (input.sourceEventType === "meeting_booked" && database.salesTask && isLeadRelated(input.relatedRecordType, input.relatedRecordId)) {
    await database.salesTask.create({
      data: {
        organizationId,
        ownerId: process.env.WORKFLOW_AUTOMATION_USER_ID!.trim(),
        title: "Follow-up from EmailVoice meeting",
        description: input.summary,
        type: "FOLLOW_UP",
        priority: "HIGH",
        source: "CRM",
        dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        leadCustomerId: input.relatedRecordId ?? null,
        opportunityId: null,
        proposalId: null,
        orderId: null
      }
    });
  }

  return event;
}

export async function listWorkflowEventsForEntity(
  organizationId: string,
  entityId: string,
  database: WorkflowEventDb = db as unknown as WorkflowEventDb
): Promise<WorkflowEventRecord[]> {
  if (database === (db as unknown as WorkflowEventDb)) {
    return withOrganization(organizationId, (tx) => listWorkflowEventsForEntity(organizationId, entityId, tx as unknown as WorkflowEventDb));
  }
  return database.workflowEvent.findMany({
    where: {
      organizationId,
      OR: [{ entityId }, { relatedRecordId: entityId }]
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }]
  });
}
