import { Prisma } from "@prisma/client";

import { withOrganization } from "@/server/organizations/with-organization";

import { mapSharedRecordRow } from "./mappers";
import type { SharedBusinessRecordDto, SharedBusinessRecordRow } from "./types";

const DEFAULT_SHARED_RECORD_EXPORT_PAGE_SIZE = 100;
export const MAX_SHARED_RECORD_EXPORT_PAGE_SIZE = 500;
const SHARED_RECORD_EXPORT_SNAPSHOT_BATCH_SIZE = 500;
const SHARED_RECORD_EXPORT_SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;

export const exportableSharedRecordTypes = ["LEAD", "CUSTOMER", "CONTACT", "ORDER"] as const;

export type ExportableSharedRecordType = (typeof exportableSharedRecordTypes)[number];

type SharedRecordExportCursor = {
  snapshotId: string;
  entityType: ExportableSharedRecordType | null;
  offset: number;
};

type SharedRecordExportSnapshot = {
  id: string;
  entityType: ExportableSharedRecordType | null;
  itemCount: number;
};

type SharedRecordExportSnapshotSeed = {
  id: string;
  entityType: ExportableSharedRecordType | null;
};

type SharedRecordExportMaterializationDb = {
  sharedBusinessRecord: {
    findMany: (args: Prisma.SharedBusinessRecordFindManyArgs) => Promise<SharedBusinessRecordRow[]>;
  };
  createExportSnapshot: (input: {
    entityType: ExportableSharedRecordType | undefined;
    expiresAt: Date;
  }) => Promise<SharedRecordExportSnapshotSeed>;
  appendExportSnapshotItems: (
    snapshotId: string,
    startPosition: number,
    items: SharedBusinessRecordDto[]
  ) => Promise<void>;
  finalizeExportSnapshot: (snapshotId: string, itemCount: number) => Promise<SharedRecordExportSnapshot>;
  deleteExpiredExportSnapshots: (before: Date) => Promise<void>;
};

type SharedRecordExportDb = {
  withSnapshotMaterialization: <T>(
    callback: (database: SharedRecordExportMaterializationDb) => Promise<T>
  ) => Promise<T>;
  deleteExpiredExportSnapshots: (before: Date) => Promise<void>;
  getExportSnapshot: (snapshotId: string) => Promise<SharedRecordExportSnapshot | null>;
  getExportSnapshotItems: (
    snapshotId: string,
    offset: number,
    limit: number
  ) => Promise<SharedBusinessRecordDto[]>;
};

type SharedRecordExportPersistenceClient = {
  sharedBusinessRecord: {
    findMany: (args: Prisma.SharedBusinessRecordFindManyArgs) => Promise<SharedBusinessRecordRow[]>;
  };
  sharedRecordExportSnapshot: {
    create: (args: Prisma.SharedRecordExportSnapshotCreateArgs) => Promise<{
      id: string;
      entityType: ExportableSharedRecordType | null;
    }>;
    update: (args: Prisma.SharedRecordExportSnapshotUpdateArgs) => Promise<{
      id: string;
      entityType: ExportableSharedRecordType | null;
      itemCount: number;
    }>;
    findFirst: (args: Prisma.SharedRecordExportSnapshotFindFirstArgs) => Promise<{
      id: string;
      entityType: ExportableSharedRecordType | null;
      itemCount: number;
    } | null>;
    deleteMany: (args: Prisma.SharedRecordExportSnapshotDeleteManyArgs) => Promise<unknown>;
  };
  sharedRecordExportSnapshotItem: {
    createMany: (args: Prisma.SharedRecordExportSnapshotItemCreateManyArgs) => Promise<unknown>;
    findMany: (args: Prisma.SharedRecordExportSnapshotItemFindManyArgs) => Promise<Array<{ payload: Prisma.JsonValue }>>;
  };
};

type MaterializationCursor = Pick<SharedBusinessRecordRow, "updatedAt" | "id">;

export type SharedRecordExportFilters = {
  entityType?: ExportableSharedRecordType;
  cursor?: string | null;
  limit?: number;
};

export class SharedRecordExportError extends Error {}

function normalizeEntityType(
  entityType: ExportableSharedRecordType | "" | null | undefined
): ExportableSharedRecordType | undefined {
  return entityType ? entityType : undefined;
}

function normalizeCursorEntityType(
  entityType: string | null | undefined
): ExportableSharedRecordType | null {
  return exportableSharedRecordTypes.includes(entityType as ExportableSharedRecordType)
    ? (entityType as ExportableSharedRecordType)
    : null;
}

function encodeSharedRecordExportCursor(cursor: SharedRecordExportCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function buildNextCursor(snapshot: SharedRecordExportSnapshot, offset: number): string | null {
  return offset < snapshot.itemCount
    ? encodeSharedRecordExportCursor({
        snapshotId: snapshot.id,
        entityType: snapshot.entityType,
        offset
      })
    : null;
}

export function decodeSharedRecordExportCursor(cursor: string | null | undefined): SharedRecordExportCursor | null {
  if (cursor == null) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<SharedRecordExportCursor>;
    const rawEntityType = parsed.entityType as string | null | undefined;
    const entityType = rawEntityType === "" || rawEntityType == null ? null : normalizeCursorEntityType(rawEntityType);

    if (
      !parsed ||
      typeof parsed.snapshotId !== "string" ||
      parsed.snapshotId.length === 0 ||
      typeof parsed.offset !== "number" ||
      !Number.isInteger(parsed.offset) ||
      parsed.offset < 0 ||
      (rawEntityType !== undefined && rawEntityType !== null && rawEntityType !== "" && entityType === null)
    ) {
      throw new SharedRecordExportError("Invalid export cursor.");
    }

    return {
      snapshotId: parsed.snapshotId,
      entityType,
      offset: parsed.offset
    };
  } catch (error) {
    if (error instanceof SharedRecordExportError) {
      throw error;
    }

    throw new SharedRecordExportError("Invalid export cursor.");
  }
}

function ensureCursorMatchesRequestedStream(
  cursor: SharedRecordExportCursor | null,
  entityType: ExportableSharedRecordType | undefined
): void {
  if (!cursor) {
    return;
  }

  if (cursor.entityType !== (entityType ?? null)) {
    throw new SharedRecordExportError("Export cursor stream does not match the requested stream.");
  }
}

function buildExportWhere(
  organizationId: string,
  entityType: ExportableSharedRecordType | undefined
): Prisma.SharedBusinessRecordWhereInput {
  return {
    organizationId,
    archivedAt: null,
    ...(entityType ? { entityType } : { entityType: { in: [...exportableSharedRecordTypes] } })
  };
}

function buildMaterializationCursorWhere(cursor: MaterializationCursor): Prisma.SharedBusinessRecordWhereInput {
  return {
    OR: [{ updatedAt: { lt: cursor.updatedAt } }, { updatedAt: cursor.updatedAt, id: { lt: cursor.id } }]
  };
}

function createPrismaMaterializationDb(
  organizationId: string,
  client: SharedRecordExportPersistenceClient
): SharedRecordExportMaterializationDb {
  return {
    sharedBusinessRecord: {
      findMany: (args) => client.sharedBusinessRecord.findMany(args)
    },
    async createExportSnapshot({ entityType, expiresAt }) {
      const snapshot = await client.sharedRecordExportSnapshot.create({
        data: {
          organizationId,
          entityType: entityType ?? null,
          expiresAt
        }
      });

      return {
        id: snapshot.id,
        entityType: normalizeCursorEntityType(snapshot.entityType)
      };
    },
    async appendExportSnapshotItems(snapshotId, startPosition, items) {
      if (items.length === 0) {
        return;
      }

      await client.sharedRecordExportSnapshotItem.createMany({
        data: items.map((item, index) => ({
          organizationId,
          snapshotId,
          position: startPosition + index,
          payload: item as unknown as Prisma.InputJsonValue
        }))
      });
    },
    async finalizeExportSnapshot(snapshotId, itemCount) {
      const snapshot = await client.sharedRecordExportSnapshot.update({
        where: { id: snapshotId },
        data: {
          itemCount
        }
      });

      return {
        id: snapshot.id,
        entityType: normalizeCursorEntityType(snapshot.entityType),
        itemCount: snapshot.itemCount
      };
    },
    async deleteExpiredExportSnapshots(before) {
      await client.sharedRecordExportSnapshot.deleteMany({
        where: {
          organizationId,
          expiresAt: {
            lt: before
          }
        }
      });
    }
  };
}

function prismaSharedRecordExportDb(
  organizationId: string,
  client: SharedRecordExportPersistenceClient
): SharedRecordExportDb {
 return {
  withSnapshotMaterialization: (callback) => callback(createPrismaMaterializationDb(organizationId, client)),
  async deleteExpiredExportSnapshots(before) {
    await client.sharedRecordExportSnapshot.deleteMany({
      where: {
        organizationId,
        expiresAt: {
          lt: before
        }
      }
    });
  },
  async getExportSnapshot(snapshotId) {
    const snapshot = await client.sharedRecordExportSnapshot.findFirst({
      where: { id: snapshotId, organizationId },
      select: {
        id: true,
        entityType: true,
        itemCount: true
      }
    });

    if (!snapshot) {
      return null;
    }

    return {
      id: snapshot.id,
      entityType: normalizeCursorEntityType(snapshot.entityType),
      itemCount: snapshot.itemCount
    };
  },
  async getExportSnapshotItems(snapshotId, offset, limit) {
    const rows = await client.sharedRecordExportSnapshotItem.findMany({
      where: {
        organizationId,
        snapshotId,
        position: {
          gte: offset
        }
      },
      orderBy: [{ position: "asc" }],
      take: limit
    });

    return rows.map((row) => row.payload as unknown as SharedBusinessRecordDto);
  }
 };
}

async function materializeSnapshotPage(
  {
    database,
    organizationId,
    entityType,
    limit
  }: {
    database: SharedRecordExportDb;
    organizationId: string;
    entityType: ExportableSharedRecordType | undefined;
    limit: number;
  }
): Promise<{ items: SharedBusinessRecordDto[]; snapshot: SharedRecordExportSnapshot }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SHARED_RECORD_EXPORT_SNAPSHOT_TTL_MS);

  return database.withSnapshotMaterialization(async (transaction) => {
    await transaction.deleteExpiredExportSnapshots(now);

    const snapshotSeed = await transaction.createExportSnapshot({
      entityType,
      expiresAt
    });
    const firstPageItems: SharedBusinessRecordDto[] = [];
    let totalCount = 0;
    let cursor: MaterializationCursor | null = null;

    while (true) {
      const rows = await transaction.sharedBusinessRecord.findMany({
        where: {
          ...buildExportWhere(organizationId, entityType),
          ...(cursor ? buildMaterializationCursorWhere(cursor) : {})
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: SHARED_RECORD_EXPORT_SNAPSHOT_BATCH_SIZE
      });

      if (rows.length === 0) {
        break;
      }

      const items = rows.map(mapSharedRecordRow);
      if (firstPageItems.length < limit) {
        firstPageItems.push(...items.slice(0, limit - firstPageItems.length));
      }
      await transaction.appendExportSnapshotItems(snapshotSeed.id, totalCount, items);
      totalCount += items.length;

      if (rows.length < SHARED_RECORD_EXPORT_SNAPSHOT_BATCH_SIZE) {
        break;
      }

      const lastRow = rows[rows.length - 1] as SharedBusinessRecordRow;
      cursor = {
        updatedAt: lastRow.updatedAt,
        id: lastRow.id
      };
    }

    return {
      items: firstPageItems,
      snapshot: await transaction.finalizeExportSnapshot(snapshotSeed.id, totalCount)
    };
  });
}

export async function buildSharedRecordExportPage(
  organizationId: string,
  filters: SharedRecordExportFilters = {},
  database?: SharedRecordExportDb
): Promise<{ items: SharedBusinessRecordDto[]; nextCursor: string | null }> {
  if (!database) {
    return withOrganization(organizationId, (transaction) =>
      buildSharedRecordExportPage(
        organizationId,
        filters,
        prismaSharedRecordExportDb(
          organizationId,
          transaction as unknown as SharedRecordExportPersistenceClient
        )
      )
    );
  }

  const limit = Math.min(
    Math.max(filters.limit ?? DEFAULT_SHARED_RECORD_EXPORT_PAGE_SIZE, 1),
    MAX_SHARED_RECORD_EXPORT_PAGE_SIZE
  );
  const entityType = normalizeEntityType(filters.entityType as ExportableSharedRecordType | "" | undefined);
  const cursor = decodeSharedRecordExportCursor(filters.cursor);
  ensureCursorMatchesRequestedStream(cursor, entityType);

  if (!cursor) {
    const { items, snapshot } = await materializeSnapshotPage({
      database,
      organizationId,
      entityType,
      limit
    });

    return {
      items,
      nextCursor: buildNextCursor(snapshot, items.length)
    };
  }

  const now = new Date();
  await database.deleteExpiredExportSnapshots(now);
  const snapshot = await database.getExportSnapshot(cursor.snapshotId);

  if (!snapshot || snapshot.entityType !== cursor.entityType || cursor.offset >= snapshot.itemCount) {
    throw new SharedRecordExportError("Invalid export cursor.");
  }

  const items = await database.getExportSnapshotItems(cursor.snapshotId, cursor.offset, limit);
  const nextOffset = cursor.offset + items.length;

  return {
    items,
    nextCursor: buildNextCursor(snapshot, nextOffset)
  };
}
