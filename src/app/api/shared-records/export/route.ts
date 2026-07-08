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

function parseLimit(limitParam: string | null): number | undefined {
  if (limitParam === null) {
    return undefined;
  }

  const trimmed = limitParam.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const limit = Number(trimmed);
  if (!Number.isFinite(limit) || !Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new SharedRecordExportError("Invalid limit.");
  }

  return limit;
}

export async function GET(request: Request) {
  const authResponse = requireSharedDataApiToken(request);
  if (authResponse) {
    return authResponse;
  }

  try {
    const searchParams = new URL(request.url).searchParams;
    const entityTypeParam = searchParams.get("entityType")?.trim() || undefined;
    const limit = parseLimit(searchParams.get("limit"));

    if (entityTypeParam && !exportableSharedRecordTypes.includes(entityTypeParam as ExportableSharedRecordType)) {
      return badRequest("Invalid entityType.");
    }

    const page = await buildSharedRecordExportPage({
      entityType: entityTypeParam as ExportableSharedRecordType | undefined,
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
