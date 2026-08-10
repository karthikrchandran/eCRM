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
    findFirst: (args: Prisma.LeadCustomerFindFirstArgs) => Promise<{ id: string; ownerId: string } | null>;
  };
  salesTask?: {
    create: (args: Prisma.SalesTaskCreateArgs) => Promise<{ id: string }>;
  };
};

function isLeadRelated(relatedRecordType?: string | null, relatedRecordId?: string | null) {
  return relatedRecordType === "LEAD" && Boolean(relatedRecordId);
}

export async function ingestWorkflowEvent(
  organizationId: string,
  input: WorkflowEventInput,
  database: WorkflowEventDb = db as unknown as WorkflowEventDb
): Promise<WorkflowEventRecord> {
  if (database === (db as unknown as WorkflowEventDb)) {
    return withOrganization(organizationId, (tx) => ingestWorkflowEvent(organizationId, input, tx as unknown as WorkflowEventDb));
  }
  if (input.sourceEventId && database.workflowEvent.findFirst) {
    const existing = await database.workflowEvent.findFirst({
      where: { organizationId, sourceApp: input.sourceApp, sourceEventId: input.sourceEventId }
    });
    if (existing) return existing;
  }

  let relatedLead: { id: string; ownerId: string } | null | undefined;
  if (isLeadRelated(input.relatedRecordType, input.relatedRecordId)) {
    relatedLead = await database.leadCustomer?.findFirst({
      where: { id: input.relatedRecordId!, organizationId },
      select: { id: true, ownerId: true }
    });
    if (!relatedLead) {
      throw new Error("Related record was not found.");
    }

    if (input.sourceEventType === "meeting_booked") {
      if (!database.$queryRaw) throw new Error("Organization member was not found.");
      await assertTenantMember(database as Required<Pick<WorkflowEventDb, "$queryRaw">>, relatedLead.ownerId, ["ADMIN", "SALES"]);
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
        ownerId: relatedLead!.ownerId,
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
