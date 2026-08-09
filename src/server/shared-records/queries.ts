import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { withOrganization } from "@/server/organizations/with-organization";
import { mapSharedRecordRow } from "./mappers";
import type { SharedBusinessRecordDto, SharedBusinessRecordRow, SharedRecordListFilters } from "./types";

type SharedRecordQueryDb = {
  sharedBusinessRecord: {
    findMany: (args: Prisma.SharedBusinessRecordFindManyArgs) => Promise<SharedBusinessRecordRow[]>;
    findFirst: (args: Prisma.SharedBusinessRecordFindFirstArgs) => Promise<SharedBusinessRecordRow | null>;
  };
};

const DEFAULT_LIMIT = 50;

export async function listSharedRecords(
  organizationId: string,
  filters: SharedRecordListFilters = {},
  database: SharedRecordQueryDb = db as unknown as SharedRecordQueryDb
): Promise<SharedBusinessRecordDto[]> {
  if (database === (db as unknown as SharedRecordQueryDb)) {
    return withOrganization(organizationId, (tx) => listSharedRecords(organizationId, filters, tx as unknown as SharedRecordQueryDb));
  }
  const limit = filters.limit ?? DEFAULT_LIMIT;
  const q = filters.q?.trim().toLowerCase();
  const where: Prisma.SharedBusinessRecordWhereInput = {
    organizationId,
    archivedAt: null,
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.parentId ? { parentId: filters.parentId } : {}),
    ...(q ? { searchText: { contains: q } } : {})
  };

  const rows = await database.sharedBusinessRecord.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    take: limit
  });

  return rows.map(mapSharedRecordRow);
}

export async function getSharedRecord(
  organizationId: string,
  recordId: string,
  database: SharedRecordQueryDb = db as unknown as SharedRecordQueryDb
): Promise<SharedBusinessRecordDto | null> {
  if (database === (db as unknown as SharedRecordQueryDb)) {
    return withOrganization(organizationId, (tx) => getSharedRecord(organizationId, recordId, tx as unknown as SharedRecordQueryDb));
  }
  const row = await database.sharedBusinessRecord.findFirst({
    where: {
      id: recordId,
      organizationId,
      archivedAt: null
    }
  });

  return row ? mapSharedRecordRow(row) : null;
}
