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
  stream: {
    entityType: ExportableSharedRecordType | null;
    asOf: string;
  };
  updatedAt: string;
  id: string;
};

export type SharedRecordExportFilters = {
  entityType?: ExportableSharedRecordType;
  cursor?: string | null;
  limit?: number;
};

export class SharedRecordExportError extends Error {}

function normalizeEntityType(entityType: ExportableSharedRecordType | "" | undefined): ExportableSharedRecordType | undefined {
  return entityType ? entityType : undefined;
}

function buildExportStreamScope(
  entityType: ExportableSharedRecordType | undefined,
  asOf: string
): SharedRecordExportCursor["stream"] {
  return {
    entityType: entityType ?? null,
    asOf
  };
}

function ensureCursorMatchesRequestedStream(
  cursor: SharedRecordExportCursor | null,
  entityType: ExportableSharedRecordType | undefined
): void {
  if (!cursor) {
    return;
  }

  if (cursor.stream.entityType !== (entityType ?? null)) {
    throw new SharedRecordExportError("Export cursor stream does not match the requested stream.");
  }
}

export function decodeSharedRecordExportCursor(cursor: string | null | undefined): SharedRecordExportCursor | null {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<SharedRecordExportCursor>;
    const normalizedEntityType = normalizeEntityType((parsed.stream?.entityType ?? null) as ExportableSharedRecordType | "" | undefined);
    if (
      !parsed ||
      typeof parsed.id !== "string" ||
      typeof parsed.updatedAt !== "string" ||
      !parsed.stream ||
      !("entityType" in parsed.stream) ||
      !("asOf" in parsed.stream) ||
      typeof parsed.stream.asOf !== "string" ||
      (normalizedEntityType !== undefined && !exportableSharedRecordTypes.includes(normalizedEntityType))
    ) {
      throw new SharedRecordExportError("Invalid export cursor.");
    }

    const updatedAt = new Date(parsed.updatedAt);
    const asOf = new Date(parsed.stream.asOf);
    if (Number.isNaN(updatedAt.getTime()) || Number.isNaN(asOf.getTime())) {
      throw new SharedRecordExportError("Invalid export cursor.");
    }

    return {
      stream: {
        entityType: normalizedEntityType ?? null,
        asOf: asOf.toISOString()
      },
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

function encodeSharedRecordExportCursor(
  stream: SharedRecordExportCursor["stream"],
  item: Pick<SharedBusinessRecordRow, "updatedAt" | "id">
): string {
  return Buffer.from(
    JSON.stringify({
      stream,
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
  const entityType = normalizeEntityType(filters.entityType as ExportableSharedRecordType | "" | undefined);
  const cursor = decodeSharedRecordExportCursor(filters.cursor);
  ensureCursorMatchesRequestedStream(cursor, entityType);
  const asOf = cursor?.stream.asOf ?? new Date().toISOString();
  const where: Prisma.SharedBusinessRecordWhereInput = {
    archivedAt: null,
    ...(entityType ? { entityType } : { entityType: { in: [...exportableSharedRecordTypes] } }),
    updatedAt: { lte: new Date(asOf) },
    ...(cursor ? buildCursorWhere(cursor) : {})
  };

  const rows = await database.sharedBusinessRecord.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit
  });

  const stream = buildExportStreamScope(entityType, asOf);

  return {
    items: rows.map(mapSharedRecordRow),
    nextCursor: rows.length === limit ? encodeSharedRecordExportCursor(stream, rows[rows.length - 1] as SharedBusinessRecordRow) : null
  };
}
