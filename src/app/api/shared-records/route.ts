import { ZodError } from "zod";
import { requireSharedDataApiToken } from "@/server/shared-records/api-auth";
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

  try {
    const searchParams = new URL(request.url).searchParams;
    const filters = sharedRecordListFilterSchema.parse(Object.fromEntries(searchParams.entries()));
    const records = await listSharedRecords(filters);

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

  try {
    const result = await upsertSharedRecord(await request.json());

    return Response.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest(error);
    }

    return Response.json({ error: "Unable to upsert shared record." }, { status: 500 });
  }
}
