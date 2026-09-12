import {
  buildSharedRecordExportPage,
  exportableSharedRecordTypes,
  MAX_SHARED_RECORD_EXPORT_PAGE_SIZE,
  type ExportableSharedRecordType,
  SharedRecordExportError
} from "@/server/shared-records/export";
import { getSharedDataOrganizationId, requireSharedDataApiToken } from "@/server/shared-records/api-auth";

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
  if (
    !Number.isFinite(limit) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_SHARED_RECORD_EXPORT_PAGE_SIZE
  ) {
    throw new SharedRecordExportError("Invalid limit.");
  }

  return limit;
}

function parseCursor(cursorParam: string | null): string | null {
  if (cursorParam === null) {
    return null;
  }

  const trimmed = cursorParam.trim();
  if (trimmed.length === 0) {
    throw new SharedRecordExportError("Invalid export cursor.");
  }

  return trimmed;
}

export async function GET(request: Request) {
  const authResponse = await requireSharedDataApiToken(request, "SHARED_RECORDS_READ");
  if (authResponse) {
    return authResponse;
  }
  const organizationId = getSharedDataOrganizationId();
  if (!organizationId) return Response.json({ error: "Shared data organization is not configured." }, { status: 500 });

  try {
    const searchParams = new URL(request.url).searchParams;
    const entityTypeParam = searchParams.get("entityType")?.trim() || undefined;
    const limit = parseLimit(searchParams.get("limit"));
    const cursor = parseCursor(searchParams.get("cursor"));

    if (entityTypeParam && !exportableSharedRecordTypes.includes(entityTypeParam as ExportableSharedRecordType)) {
      return badRequest("Invalid entityType.");
    }

    const page = await buildSharedRecordExportPage(organizationId, {
      entityType: entityTypeParam as ExportableSharedRecordType | undefined,
      cursor,
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
