import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  buildSharedRecordExportPage,
  decodeSharedRecordExportCursor,
  type ExportableSharedRecordType
} from "./export";
import type { SharedBusinessRecordDto } from "./types";

type ExportRow = {
  id: string;
  entityType: "LEAD" | "CUSTOMER" | "CONTACT" | "ORDER";
  displayName: string;
  status: string;
  ownerId: string | null;
  parentId: string | null;
  relatedLeadId: string | null;
  relatedCustomerId: string | null;
  relatedContactId: string | null;
  relatedOpportunityId: string | null;
  sourceApp: string;
  ecrmLegacyId: string | null;
  emailVoiceLegacyId: string | null;
  externalKey: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  searchText: string;
  data: Record<string, never>;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type SeededSnapshot = {
  id: string;
  entityType: ExportableSharedRecordType | null;
  expiresAt: Date;
  itemCount: number;
  items: SharedBusinessRecordDto[];
};

function exportRow(overrides: Partial<ExportRow>): ExportRow {
  return {
    id: "rec_1",
    entityType: "CONTACT",
    displayName: "Ada Lovelace",
    status: "ACTIVE",
    ownerId: null,
    parentId: "cust_1",
    relatedLeadId: null,
    relatedCustomerId: "cust_1",
    relatedContactId: null,
    relatedOpportunityId: null,
    sourceApp: "ecrm",
    ecrmLegacyId: "legacy_1",
    emailVoiceLegacyId: null,
    externalKey: "contact:ada@example.com",
    email: "ada@example.com",
    phone: null,
    companyName: "Acme",
    searchText: "ada lovelace active ada@example.com acme",
    data: {},
    archivedAt: null,
    createdAt: new Date("2026-07-07T08:00:00.000Z"),
    updatedAt: new Date("2026-07-07T09:00:00.000Z"),
    ...overrides
  };
}

function exportDto(overrides: Partial<ExportRow>): SharedBusinessRecordDto {
  const row = exportRow(overrides);

  return {
    ...row,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function createMemoryExportDatabase(liveRows: ExportRow[] = [], seededSnapshots: SeededSnapshot[] = []) {
  const snapshots = new Map(
    seededSnapshots.map((snapshot) => [
      snapshot.id,
      {
        id: snapshot.id,
        entityType: snapshot.entityType,
        expiresAt: snapshot.expiresAt,
        itemCount: snapshot.itemCount,
        items: snapshot.items
      }
    ])
  );

  const findMany = vi
    .fn<(_: Prisma.SharedBusinessRecordFindManyArgs) => Promise<ExportRow[]>>()
    .mockImplementation(async (args) => {
      const entityTypeFilter = args.where?.entityType;
      const filteredRows = liveRows.filter((row) => {
        if (typeof entityTypeFilter === "string") {
          return row.entityType === entityTypeFilter;
        }

        const allowed = (entityTypeFilter as { in?: ExportRow["entityType"][] } | undefined)?.in;
        return allowed ? allowed.includes(row.entityType) : true;
      });
      const afterId = ((args.where as { OR?: Array<{ id?: { lt?: string } }> } | undefined)?.OR?.[1]?.id?.lt ?? null) as string | null;
      const startIndex = afterId ? filteredRows.findIndex((row) => row.id === afterId) + 1 : 0;

      return filteredRows.slice(startIndex, startIndex + (args.take ?? filteredRows.length));
    });

  const createExportSnapshot = vi
    .fn<
      (input: {
        entityType: ExportableSharedRecordType | undefined;
        expiresAt: Date;
      }) => Promise<{ id: string; entityType: ExportableSharedRecordType | null }>
    >()
    .mockImplementation(async ({ entityType, expiresAt }) => {
      const id = `snapshot_${snapshots.size + 1}`;
      snapshots.set(id, {
        id,
        entityType: entityType ?? null,
        expiresAt,
        itemCount: 0,
        items: []
      });

      return {
        id,
        entityType: entityType ?? null
      };
    });

  const appendExportSnapshotItems = vi
    .fn<(snapshotId: string, startPosition: number, items: SharedBusinessRecordDto[]) => Promise<void>>()
    .mockImplementation(async (snapshotId, startPosition, items) => {
      const snapshot = snapshots.get(snapshotId);
      if (!snapshot) {
        throw new Error(`missing snapshot ${snapshotId}`);
      }

      for (const [index, item] of items.entries()) {
        snapshot.items[startPosition + index] = item;
      }
    });

  const finalizeExportSnapshot = vi
    .fn<
      (snapshotId: string, itemCount: number) => Promise<{ id: string; entityType: ExportableSharedRecordType | null; itemCount: number }>
    >()
    .mockImplementation(async (snapshotId, itemCount) => {
      const snapshot = snapshots.get(snapshotId);
      if (!snapshot) {
        throw new Error(`missing snapshot ${snapshotId}`);
      }

      snapshot.itemCount = itemCount;

      return {
        id: snapshot.id,
        entityType: snapshot.entityType,
        itemCount: snapshot.itemCount
      };
    });

  const deleteExpiredExportSnapshots = vi
    .fn<(before: Date) => Promise<void>>()
    .mockImplementation(async (before) => {
      for (const [snapshotId, snapshot] of snapshots.entries()) {
        if (snapshot.expiresAt < before) {
          snapshots.delete(snapshotId);
        }
      }
    });

  const getExportSnapshot = vi
    .fn<
      (snapshotId: string) => Promise<{ id: string; entityType: ExportableSharedRecordType | null; itemCount: number } | null>
    >()
    .mockImplementation(async (snapshotId) => {
      const snapshot = snapshots.get(snapshotId);

      if (!snapshot) {
        return null;
      }

      return {
        id: snapshot.id,
        entityType: snapshot.entityType,
        itemCount: snapshot.itemCount
      };
    });

  const getExportSnapshotItems = vi
    .fn<(snapshotId: string, offset: number, limit: number) => Promise<SharedBusinessRecordDto[]>>()
    .mockImplementation(async (snapshotId, offset, limit) => {
      const snapshot = snapshots.get(snapshotId);

      return snapshot ? snapshot.items.slice(offset, offset + limit) : [];
    });

  const materializationDb = {
    sharedBusinessRecord: {
      findMany
    },
    createExportSnapshot,
    appendExportSnapshotItems,
    finalizeExportSnapshot,
    deleteExpiredExportSnapshots
  };

  return {
    database: {
      withSnapshotMaterialization: async <T>(callback: (database: typeof materializationDb) => Promise<T>) =>
        callback(materializationDb),
      deleteExpiredExportSnapshots,
      getExportSnapshot,
      getExportSnapshotItems
    },
    liveRows,
    snapshots,
    findMany,
    createExportSnapshot,
    appendExportSnapshotItems,
    finalizeExportSnapshot,
    deleteExpiredExportSnapshots,
    getExportSnapshot,
    getExportSnapshotItems
  };
}

describe("buildSharedRecordExportPage", () => {
  it("materializes the snapshot in bounded chunks before returning the first page", async () => {
    const baseTime = Date.parse("2026-07-07T12:00:00.000Z");
    const liveRows = Array.from({ length: 501 }, (_, index) =>
      exportRow({
        id: `rec_${String(501 - index).padStart(3, "0")}`,
        displayName: `Contact ${501 - index}`,
        updatedAt: new Date(baseTime - index * 60_000),
        ecrmLegacyId: `legacy_${501 - index}`
      })
    );
    const {
      database,
      findMany,
      createExportSnapshot,
      appendExportSnapshotItems,
      finalizeExportSnapshot,
      getExportSnapshot,
      getExportSnapshotItems
    } = createMemoryExportDatabase(liveRows);

    const page = await buildSharedRecordExportPage({ entityType: "CONTACT", cursor: null, limit: 1 }, database);

    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        archivedAt: null,
        entityType: "CONTACT"
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 500
    });
    expect(findMany.mock.calls[1]?.[0]).toMatchObject({
      where: {
        archivedAt: null,
        entityType: "CONTACT",
        OR: [
          { updatedAt: { lt: liveRows[499]?.updatedAt } },
          { updatedAt: liveRows[499]?.updatedAt, id: { lt: liveRows[499]?.id } }
        ]
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 500
    });
    expect(createExportSnapshot).toHaveBeenCalledTimes(1);
    expect(appendExportSnapshotItems).toHaveBeenCalledTimes(2);
    expect(appendExportSnapshotItems.mock.calls[0]?.[1]).toBe(0);
    expect(appendExportSnapshotItems.mock.calls[0]?.[2]).toHaveLength(500);
    expect(appendExportSnapshotItems.mock.calls[1]?.[1]).toBe(500);
    expect(appendExportSnapshotItems.mock.calls[1]?.[2]).toHaveLength(1);
    expect(finalizeExportSnapshot).toHaveBeenCalledWith("snapshot_1", 501);
    expect(getExportSnapshot).not.toHaveBeenCalled();
    expect(getExportSnapshotItems).not.toHaveBeenCalled();
    expect(page.items.map((item) => item.id)).toEqual(["rec_501"]);
    expect(decodeSharedRecordExportCursor(page.nextCursor)).toEqual({
      snapshotId: "snapshot_1",
      entityType: "CONTACT",
      offset: 1
    });
  });

  it("uses the stored snapshot items for continuation pages even if live rows change", async () => {
    const liveRows = [
      exportRow({ id: "rec_3", displayName: "Ada Lovelace", updatedAt: new Date("2026-07-07T10:00:00.000Z") }),
      exportRow({ id: "rec_2", displayName: "Alan Turing", updatedAt: new Date("2026-07-07T09:30:00.000Z") }),
      exportRow({ id: "rec_1", displayName: "Grace Hopper", updatedAt: new Date("2026-07-07T09:00:00.000Z") })
    ];
    const { database, liveRows: mutableLiveRows, findMany, deleteExpiredExportSnapshots, getExportSnapshot, getExportSnapshotItems } =
      createMemoryExportDatabase(liveRows);

    const firstPage = await buildSharedRecordExportPage({ entityType: "CONTACT", cursor: null, limit: 2 }, database);

    mutableLiveRows.splice(
      0,
      mutableLiveRows.length,
      exportRow({ id: "rec_4", displayName: "New Contact", updatedAt: new Date("2026-07-07T11:00:00.000Z") }),
      exportRow({ id: "rec_1", displayName: "Grace Hopper Updated", updatedAt: new Date("2026-07-07T10:45:00.000Z") })
    );

    const secondPage = await buildSharedRecordExportPage(
      { entityType: "CONTACT", cursor: firstPage.nextCursor, limit: 2 },
      database
    );

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(deleteExpiredExportSnapshots).toHaveBeenCalled();
    expect(getExportSnapshot).toHaveBeenCalledWith("snapshot_1");
    expect(getExportSnapshotItems).toHaveBeenCalledWith("snapshot_1", 2, 2);
    expect(secondPage.items).toEqual([
      exportDto({ id: "rec_1", displayName: "Grace Hopper", updatedAt: new Date("2026-07-07T09:00:00.000Z") })
    ]);
    expect(secondPage.nextCursor).toBeNull();
  });

  it("rejects a cursor from a different requested stream", async () => {
    const { database } = createMemoryExportDatabase();
    const cursor = Buffer.from(
      JSON.stringify({
        snapshotId: "snapshot_1",
        entityType: "CONTACT",
        offset: 2
      }),
      "utf8"
    ).toString("base64url");

    await expect(buildSharedRecordExportPage({ entityType: "CUSTOMER", cursor, limit: 2 }, database)).rejects.toThrow(
      "Export cursor stream does not match the requested stream."
    );
  });

  it("rejects a cursor whose persisted snapshot does not match the cursor stream", async () => {
    const { database } = createMemoryExportDatabase([], [
      {
        id: "snapshot_42",
        entityType: "CUSTOMER",
        expiresAt: new Date("2099-07-07T10:00:00.000Z"),
        itemCount: 1,
        items: [exportDto({ id: "cust_1", entityType: "CUSTOMER", displayName: "Acme Corp", parentId: null, relatedCustomerId: null })]
      }
    ]);
    const cursor = Buffer.from(
      JSON.stringify({
        snapshotId: "snapshot_42",
        entityType: "CONTACT",
        offset: 0
      }),
      "utf8"
    ).toString("base64url");

    await expect(buildSharedRecordExportPage({ entityType: "CONTACT", cursor, limit: 1 }, database)).rejects.toThrow(
      "Invalid export cursor."
    );
  });

  it("invalidates cursors for expired snapshots", async () => {
    const { database } = createMemoryExportDatabase([], [
      {
        id: "snapshot_expired",
        entityType: "CONTACT",
        expiresAt: new Date("2000-01-01T00:00:00.000Z"),
        itemCount: 1,
        items: [exportDto({ id: "rec_1" })]
      }
    ]);
    const cursor = Buffer.from(
      JSON.stringify({
        snapshotId: "snapshot_expired",
        entityType: "CONTACT",
        offset: 0
      }),
      "utf8"
    ).toString("base64url");

    await expect(buildSharedRecordExportPage({ entityType: "CONTACT", cursor, limit: 1 }, database)).rejects.toThrow(
      "Invalid export cursor."
    );
  });

  it("rejects blank cursors in the core helper contract", () => {
    expect(() => decodeSharedRecordExportCursor("")).toThrow("Invalid export cursor.");
  });

  it("treats an empty entityType value as the all-entities stream", async () => {
    const liveRows = [
      exportRow({ id: "rec_5", entityType: "LEAD", updatedAt: new Date("2026-07-07T12:00:00.000Z") }),
      exportRow({ id: "rec_4", entityType: "ORDER", updatedAt: new Date("2026-07-07T11:00:00.000Z") })
    ];
    const { database, findMany, createExportSnapshot } = createMemoryExportDatabase(liveRows);

    const page = await buildSharedRecordExportPage({ entityType: "" as never, cursor: null, limit: 1 }, database);

    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        archivedAt: null,
        entityType: { in: ["LEAD", "CUSTOMER", "CONTACT", "ORDER"] }
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 500
    });
    expect(createExportSnapshot.mock.calls[0]?.[0].entityType).toBeUndefined();
    expect(page.items.map((item) => item.id)).toEqual(["rec_5"]);
    expect(decodeSharedRecordExportCursor(page.nextCursor)).toEqual({
      snapshotId: "snapshot_1",
      entityType: null,
      offset: 1
    });
  });
});
