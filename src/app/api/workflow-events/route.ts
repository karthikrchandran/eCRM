import { z } from "zod";
import { requireSharedDataApiToken } from "@/server/shared-records/api-auth";
import { ingestWorkflowEvent } from "@/server/workflow-events/service";

const workflowEventSchema = z.object({
  sourceApp: z.string().trim().min(1),
  sourceEventId: z.string().trim().min(1).optional(),
  sourceEventType: z.string().trim().min(1),
  entityType: z.string().trim().min(1),
  entityId: z.string().trim().min(1).nullable().optional(),
  relatedRecordType: z.string().trim().min(1).nullable().optional(),
  relatedRecordId: z.string().trim().min(1).nullable().optional(),
  summary: z.string().trim().min(1),
  payload: z.record(z.string(), z.unknown()).optional(),
  occurredAt: z.coerce.date().optional()
});

export async function POST(request: Request) {
  const authResponse = await requireSharedDataApiToken(request, "WORKFLOW_EVENTS_WRITE");
  if (authResponse) return authResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  try {
    const event = await ingestWorkflowEvent(workflowEventSchema.parse(body));
    return Response.json({ event }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid workflow event.", details: error.flatten().fieldErrors }, { status: 400 });
    }
    return Response.json({ error: "Unable to ingest workflow event." }, { status: 500 });
  }
}
