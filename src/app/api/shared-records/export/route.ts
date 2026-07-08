import {
  buildSharedRecordExportPage,
  exportableSharedRecordTypes,
  type ExportableSharedRecordType,
  SharedRecordExportError
} from "@/server/shared-records/export";
import { requireSharedDataApiToken } from "@/server/shared-records/api-auth";

function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}

export async function GET(request: Request) {
  const authResponse = requireSharedDataApiToken(request);
  if (authResponse) {
    return authResponse;
  }

  try {
    const searchParams = new URL(request.url).searchParams;
    const entityTypeParam = searchParams.get("entityType");
    const limitParam = searchParams.get("limit");
    const limit = limitParam === null ? undefined : Number(limitParam);

    if (entityTypeParam && !exportableSharedRecordTypes.includes(entityTypeParam as ExportableSharedRecordType)) {
      return badRequest("Invalid entityType.");
    }

    if (limitParam !== null && (!Number.isFinite(limit) || !Number.isInteger(limit))) {
      return badRequest("Invalid limit.");
    }

    const page = await buildSharedRecordExportPage({
      entityType: entityTypeParam === null ? undefined : (entityTypeParam as ExportableSharedRecordType),
      cursor: searchParams.get("cursor"),
      limit
    });

    return Response.json(page);
  } catch (error) {
    if (error instanceof SharedRecordExportError) {
      return badRequest(error.message);
    }

    return Response.json({ error: "Unable to export shared records." }, { status: 500 });
  }
}
