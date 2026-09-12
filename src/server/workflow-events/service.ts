import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { mutateWithCellOutbox } from "@/server/integration-delivery/source-outbox";
import { parseRuntimeConfig } from "@/server/runtime/cell-config";

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
  workflowEvent: {
    create: (args: Prisma.WorkflowEventCreateArgs) => Promise<WorkflowEventRecord>;
    findMany: (args: Prisma.WorkflowEventFindManyArgs) => Promise<WorkflowEventRecord[]>;
    findFirst?: (args: Prisma.WorkflowEventFindFirstArgs) => Promise<WorkflowEventRecord | null>;
  };
  salesTask?: {
    create: (args: Prisma.SalesTaskCreateArgs) => Promise<{ id: string }>;
  };
  $transaction?: <T>(operation: (transaction: unknown) => Promise<T>) => Promise<T>;
};

function isLeadRelated(relatedRecordType?: string | null, relatedRecordId?: string | null) {
  return relatedRecordType === "LEAD" && Boolean(relatedRecordId);
}

export async function ingestWorkflowEvent(
  input: WorkflowEventInput,
  database: WorkflowEventDb = db as unknown as WorkflowEventDb
): Promise<WorkflowEventRecord> {
  const runtime = parseRuntimeConfig({ ...process.env, APP_MODE: process.env.APP_MODE ?? "platform" });
  if (database.$transaction && runtime.mode === "cell") {
    return mutateWithCellOutbox({
      database: database as never,
      runtime,
      destinationInstallation: process.env.INTEGRATION_DESTINATION_INSTALLATION ?? "",
      eventType: "workflow-event.ingested",
      correlationId: input.sourceEventId ?? `corr_${randomUUID()}`,
      idempotencyKey: (event) => `workflow-event:${event.sourceApp}:${event.sourceEventId ?? event.id}:1`,
      mutate: (transaction) => ingestWorkflowEventCore(input, transaction as unknown as WorkflowEventDb),
      payload: (event) => ({ workflowEventId: event.id, sourceEventType: event.sourceEventType, entityType: event.entityType }),
      payloadVersion: () => 1
    });
  }
  return ingestWorkflowEventCore(input, database);
}

async function ingestWorkflowEventCore(
  input: WorkflowEventInput,
  database: WorkflowEventDb
): Promise<WorkflowEventRecord> {
  if (input.sourceEventId && database.workflowEvent.findFirst) {
    const existing = await database.workflowEvent.findFirst({
      where: { sourceApp: input.sourceApp, sourceEventId: input.sourceEventId }
    });
    if (existing) return existing;
  }

  const event = await database.workflowEvent.create({
    data: {
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
