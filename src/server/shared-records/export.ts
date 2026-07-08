import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { mapSharedRecordRow } from "./mappers";
import type { SharedBusinessRecordDto, SharedBusinessRecordRow } from "./types";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export const exportableSharedRecordTypes = ["LEAD", "CUSTOMER", "CONTACT", "ORDER"] as const;

export type ExportableSharedRecordType = (typeof exportableSharedRecordTypes)[number];

type SharedRecordExportDb = {
  sharedBusinessRecord: {
    findMany: (args: Prisma.SharedBusinessRecordFindManyArgs) => Promise<SharedBusinessRecordRow[]>;
  };
};

type SharedRecordExportCursor = {
  entityType: ExportableSharedRecordType;
  updatedAt: string;
  id: string;
};

export type SharedRecordExportFilters = {
  entityType?: ExportableSharedRecordType;
  cursor?: string | null;
  limit?: number;
};

export class SharedRecordExportError extends Error {}

export function decodeSharedRecordExportCursor(cursor: string | null | undefined): SharedRecordExportCursor | null {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<SharedRecordExportCursor>;
    if (
      !parsed ||
      typeof parsed.id !== "string" ||
      typeof parsed.updatedAt !== "string" ||
      typeof parsed.entityType !== "string" ||
      !exportableSharedRecordTypes.includes(parsed.entityType as ExportableSharedRecordType)
    ) {
      throw new SharedRecordExportError("Invalid export cursor.");
    }

    const updatedAt = new Date(parsed.updatedAt);
    if (Number.isNaN(updatedAt.getTime())) {
      throw new SharedRecordExportError("Invalid export cursor.");
    }

    return {
      entityType: parsed.entityType as ExportableSharedRecordType,
      updatedAt: updatedAt.toISOString(),
      id: parsed.id
    };
  } catch (error) {
    if (error instanceof SharedRecordExportError) {
      throw error;
    }

    throw new SharedRecordExportError("Invalid export cursor.");
  }
}

function encodeSharedRecordExportCursor(item: Pick<SharedBusinessRecordRow, "entityType" | "updatedAt" | "id">): string {
  if (!exportableSharedRecordTypes.includes(item.entityType as ExportableSharedRecordType)) {
    throw new SharedRecordExportError("Unsupported shared record type in export page.");
  }

  return Buffer.from(
    JSON.stringify({
      entityType: item.entityType as ExportableSharedRecordType,
      updatedAt: item.updatedAt.toISOString(),
      id: item.id
    } satisfies SharedRecordExportCursor),
    "utf8"
  ).toString("base64url");
}

function buildCursorWhere(cursor: SharedRecordExportCursor): Prisma.SharedBusinessRecordWhereInput {
  const updatedAt = new Date(cursor.updatedAt);

  return {
    OR: [{ updatedAt: { lt: updatedAt } }, { updatedAt, id: { lt: cursor.id } }]
  };
}

export async function buildSharedRecordExportPage(
  filters: SharedRecordExportFilters = {},
  database: SharedRecordExportDb = db as unknown as SharedRecordExportDb
): Promise<{ items: SharedBusinessRecordDto[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const cursor = decodeSharedRecordExportCursor(filters.cursor);
  const where: Prisma.SharedBusinessRecordWhereInput = {
    archivedAt: null,
    ...(filters.entityType ? { entityType: filters.entityType } : { entityType: { in: [...exportableSharedRecordTypes] } }),
    ...(cursor ? buildCursorWhere(cursor) : {})
  };

  const rows = await database.sharedBusinessRecord.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit
  });

  return {
    items: rows.map(mapSharedRecordRow),
    nextCursor: rows.length === limit ? encodeSharedRecordExportCursor(rows[rows.length - 1] as SharedBusinessRecordRow) : null
  };
}
