import { requireSharedDataApiToken } from "@/server/shared-records/api-auth";
import { getSharedRecord } from "@/server/shared-records/queries";

type SharedRecordRouteContext = {
  params: Promise<{
    recordId: string;
  }>;
};

export async function GET(request: Request, context: SharedRecordRouteContext) {
  const authResponse = await requireSharedDataApiToken(request, "SHARED_RECORDS_READ");
  if (authResponse) {
    return authResponse;
  }

  try {
    const { recordId } = await context.params;
    const record = await getSharedRecord(recordId);

    if (!record) {
      return Response.json({ error: "Shared record was not found." }, { status: 404 });
    }

    return Response.json({ record });
  } catch {
    return Response.json({ error: "Unable to load shared record." }, { status: 500 });
  }
}
