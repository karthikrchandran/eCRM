import type { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildSharedRecordExportPage, decodeSharedRecordExportCursor } from "./export";

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

describe("buildSharedRecordExportPage", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("requests deterministic ordering and emits a cursor from the last item in the page", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T10:30:00.000Z"));

    const findMany = vi
      .fn<(_: Prisma.SharedBusinessRecordFindManyArgs) => Promise<ExportRow[]>>()
      .mockResolvedValue([
        exportRow({ id: "rec_3", updatedAt: new Date("2026-07-07T10:00:00.000Z"), ecrmLegacyId: "legacy_3" }),
        exportRow({ id: "rec_2", updatedAt: new Date("2026-07-07T10:00:00.000Z"), ecrmLegacyId: "legacy_2" })
      ]);

    const page = await buildSharedRecordExportPage(
      { entityType: "CONTACT", cursor: null, limit: 2 },
      {
        sharedBusinessRecord: {
          findMany
        }
      }
    );

    expect(findMany).toHaveBeenCalledWith({
      where: {
        archivedAt: null,
        entityType: "CONTACT",
        updatedAt: { lte: new Date("2026-07-07T10:30:00.000Z") }
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 2
    });
    expect(page.items.map((item) => item.id)).toEqual(["rec_3", "rec_2"]);
    expect(decodeSharedRecordExportCursor(page.nextCursor)).toEqual({
      stream: {
        entityType: "CONTACT",
        asOf: "2026-07-07T10:30:00.000Z"
      },
      updatedAt: "2026-07-07T10:00:00.000Z",
      id: "rec_2"
    });
  });

  it("emits an all-entities stream cursor when no entity filter is requested", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T11:30:00.000Z"));

    const findMany = vi
      .fn<(_: Prisma.SharedBusinessRecordFindManyArgs) => Promise<ExportRow[]>>()
      .mockResolvedValue([exportRow({ id: "rec_4", entityType: "ORDER", updatedAt: new Date("2026-07-07T11:00:00.000Z") })]);

    const page = await buildSharedRecordExportPage(
      { cursor: null, limit: 1 },
      {
        sharedBusinessRecord: {
          findMany
        }
      }
    );

    expect(findMany).toHaveBeenCalledWith({
      where: {
        archivedAt: null,
        entityType: { in: ["LEAD", "CUSTOMER", "CONTACT", "ORDER"] },
        updatedAt: { lte: new Date("2026-07-07T11:30:00.000Z") }
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 1
    });
    expect(decodeSharedRecordExportCursor(page.nextCursor)).toEqual({
      stream: {
        entityType: null,
        asOf: "2026-07-07T11:30:00.000Z"
      },
      updatedAt: "2026-07-07T11:00:00.000Z",
      id: "rec_4"
    });
  });

  it("treats an empty entityType value as the all-entities stream", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T12:30:00.000Z"));

    const findMany = vi
      .fn<(_: Prisma.SharedBusinessRecordFindManyArgs) => Promise<ExportRow[]>>()
      .mockResolvedValue([exportRow({ id: "rec_5", entityType: "LEAD", updatedAt: new Date("2026-07-07T12:00:00.000Z") })]);

    const page = await buildSharedRecordExportPage(
      { entityType: "" as never, cursor: null, limit: 1 },
      {
        sharedBusinessRecord: {
          findMany
        }
      }
    );

    expect(findMany).toHaveBeenCalledWith({
      where: {
        archivedAt: null,
        entityType: { in: ["LEAD", "CUSTOMER", "CONTACT", "ORDER"] },
        updatedAt: { lte: new Date("2026-07-07T12:30:00.000Z") }
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 1
    });
    expect(decodeSharedRecordExportCursor(page.nextCursor)).toEqual({
      stream: {
        entityType: null,
        asOf: "2026-07-07T12:30:00.000Z"
      },
      updatedAt: "2026-07-07T12:00:00.000Z",
      id: "rec_5"
    });
  });

  it("uses the cursor to continue from the next deterministic slice", async () => {
    const findMany = vi
      .fn<(_: Prisma.SharedBusinessRecordFindManyArgs) => Promise<ExportRow[]>>()
      .mockResolvedValue([exportRow({ id: "rec_1", updatedAt: new Date("2026-07-07T09:00:00.000Z") })]);

    const page = await buildSharedRecordExportPage(
      {
        entityType: "CONTACT",
        cursor: Buffer.from(
          JSON.stringify({
            stream: {
              entityType: "CONTACT",
              asOf: "2026-07-07T10:30:00.000Z"
            },
            updatedAt: "2026-07-07T10:00:00.000Z",
            id: "rec_2"
          }),
          "utf8"
        ).toString("base64url"),
        limit: 2
      },
      {
        sharedBusinessRecord: {
          findMany
        }
      }
    );

    expect(findMany).toHaveBeenCalledWith({
      where: {
        archivedAt: null,
        entityType: "CONTACT",
        updatedAt: { lte: new Date("2026-07-07T10:30:00.000Z") },
        OR: [
          { updatedAt: { lt: new Date("2026-07-07T10:00:00.000Z") } },
          {
            updatedAt: new Date("2026-07-07T10:00:00.000Z"),
            id: { lt: "rec_2" }
          }
        ]
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 2
    });
    expect(page.items.map((item) => item.id)).toEqual(["rec_1"]);
    expect(page.nextCursor).toBeNull();
  });

  it("rejects a cursor from a different entity-scoped stream", async () => {
    await expect(
      buildSharedRecordExportPage(
        {
          entityType: "CUSTOMER",
          cursor: Buffer.from(
            JSON.stringify({
              stream: {
                entityType: "CONTACT",
                asOf: "2026-07-07T10:00:00.000Z"
              },
              updatedAt: "2026-07-07T10:00:00.000Z",
              id: "rec_2"
            }),
            "utf8"
          ).toString("base64url"),
          limit: 2
        },
        {
          sharedBusinessRecord: {
            findMany: vi.fn()
          }
        }
      )
    ).rejects.toThrow("Export cursor stream does not match the requested stream.");
  });

  it("rejects a cursor from the all-entities stream when a scoped stream is requested", async () => {
    await expect(
      buildSharedRecordExportPage(
        {
          entityType: "CONTACT",
          cursor: Buffer.from(
            JSON.stringify({
              stream: {
                entityType: null,
                asOf: "2026-07-07T10:00:00.000Z"
              },
              updatedAt: "2026-07-07T10:00:00.000Z",
              id: "rec_2"
            }),
            "utf8"
          ).toString("base64url"),
          limit: 2
        },
        {
          sharedBusinessRecord: {
            findMany: vi.fn()
          }
        }
      )
    ).rejects.toThrow("Export cursor stream does not match the requested stream.");
  });

  it("keeps the first page watermark across continuation pages", async () => {
    const findMany = vi
      .fn<(_: Prisma.SharedBusinessRecordFindManyArgs) => Promise<ExportRow[]>>()
      .mockResolvedValue([exportRow({ id: "rec_6", updatedAt: new Date("2026-07-07T09:00:00.000Z") })]);

    await buildSharedRecordExportPage(
      {
        cursor: Buffer.from(
          JSON.stringify({
            stream: {
              entityType: null,
              asOf: "2026-07-07T10:30:00.000Z"
            },
            updatedAt: "2026-07-07T10:00:00.000Z",
            id: "rec_2"
          }),
          "utf8"
        ).toString("base64url"),
        limit: 2
      },
      {
        sharedBusinessRecord: {
          findMany
        }
      }
    );

    expect(findMany).toHaveBeenCalledWith({
      where: {
        archivedAt: null,
        entityType: { in: ["LEAD", "CUSTOMER", "CONTACT", "ORDER"] },
        updatedAt: { lte: new Date("2026-07-07T10:30:00.000Z") },
        OR: [
          { updatedAt: { lt: new Date("2026-07-07T10:00:00.000Z") } },
          {
            updatedAt: new Date("2026-07-07T10:00:00.000Z"),
            id: { lt: "rec_2" }
          }
        ]
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 2
    });
  });

  it("decodes legacy all-entities cursors with empty-string scope", () => {
    const cursor = Buffer.from(
      JSON.stringify({
        stream: {
          entityType: "",
          asOf: "2026-07-07T10:30:00.000Z"
        },
        updatedAt: "2026-07-07T10:00:00.000Z",
        id: "rec_2"
      }),
      "utf8"
    ).toString("base64url");

    expect(decodeSharedRecordExportCursor(cursor)).toEqual({
      stream: {
        entityType: null,
        asOf: "2026-07-07T10:30:00.000Z"
      },
      updatedAt: "2026-07-07T10:00:00.000Z",
      id: "rec_2"
    });
  });
});
