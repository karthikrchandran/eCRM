import { ZodError } from "zod";
import { getSharedDataOrganizationId, requireSharedDataApiToken } from "@/server/shared-records/api-auth";
import { upsertSharedRecord } from "@/server/shared-records/mutations";
import { listSharedRecords } from "@/server/shared-records/queries";
import { sharedRecordListFilterSchema } from "@/server/shared-records/validators";

function badRequest(error: ZodError) {
  return Response.json({ error: "Invalid request.", details: error.flatten().fieldErrors }, { status: 400 });
}

export async function GET(request: Request) {
  const authResponse = requireSharedDataApiToken(request);
  if (authResponse) {
    return authResponse;
  }
  const organizationId = getSharedDataOrganizationId();
  if (!organizationId) return Response.json({ error: "Shared data organization is not configured." }, { status: 500 });

  try {
    const searchParams = new URL(request.url).searchParams;
    const filters = sharedRecordListFilterSchema.parse(Object.fromEntries(searchParams.entries()));
    const records = await listSharedRecords(organizationId, filters);

    return Response.json({ records });
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest(error);
    }

    return Response.json({ error: "Unable to list shared records." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResponse = requireSharedDataApiToken(request);
  if (authResponse) {
    return authResponse;
  }
  const organizationId = getSharedDataOrganizationId();
  if (!organizationId) return Response.json({ error: "Shared data organization is not configured." }, { status: 500 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  try {
    const result = await upsertSharedRecord(organizationId, body);

    return Response.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest(error);
    }

    return Response.json({ error: "Unable to upsert shared record." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authResponse = requireSharedDataApiToken(request);
  if (authResponse) {
    return authResponse;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  try {
    const event = await import("@/server/workflow-events/service").then((module) => module.ingestWorkflowEvent(body as never));
    return Response.json({ event }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest(error);
    }

    return Response.json({ error: "Unable to ingest workflow event." }, { status: 500 });
  }
}
