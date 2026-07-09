import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";

export type WorkflowEventInput = {
  sourceApp: string;
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
  workflowEvent: {
    create: (args: Prisma.WorkflowEventCreateArgs) => Promise<WorkflowEventRecord>;
    findMany: (args: Prisma.WorkflowEventFindManyArgs) => Promise<WorkflowEventRecord[]>;
  };
  salesTask?: {
    create: (args: Prisma.SalesTaskCreateArgs) => Promise<{ id: string }>;
  };
};

function isLeadRelated(relatedRecordType?: string | null, relatedRecordId?: string | null) {
  return relatedRecordType === "LEAD" && Boolean(relatedRecordId);
}

export async function ingestWorkflowEvent(
  input: WorkflowEventInput,
  database: WorkflowEventDb = db as unknown as WorkflowEventDb
): Promise<WorkflowEventRecord> {
  const event = await database.workflowEvent.create({
    data: {
      sourceApp: input.sourceApp,
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
        ownerId: "system",
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
  entityId: string,
  database: WorkflowEventDb = db as unknown as WorkflowEventDb
): Promise<WorkflowEventRecord[]> {
  return database.workflowEvent.findMany({
    where: {
      OR: [{ entityId }, { relatedRecordId: entityId }]
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }]
  });
}
