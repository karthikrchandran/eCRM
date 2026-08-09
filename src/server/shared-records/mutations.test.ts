import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { upsertSharedRecord } from "./mutations";
import type { SharedBusinessRecordRow } from "./types";

function sharedRecordRow(overrides: Partial<SharedBusinessRecordRow> = {}): SharedBusinessRecordRow {
  return {
    id: "shared_1",
    entityType: "CUSTOMER",
    displayName: "Acme Learning",
    status: "ACTIVE",
    ownerId: null,
    parentId: null,
    relatedLeadId: null,
    relatedCustomerId: null,
    relatedContactId: null,
    relatedOpportunityId: null,
    sourceApp: "ecrm",
    ecrmLegacyId: "lead_1",
    emailVoiceLegacyId: null,
    externalKey: null,
    email: null,
    phone: null,
    companyName: null,
    searchText: "acme learning active lead_1",
    data: {},
    archivedAt: null,
    createdAt: new Date("2026-06-24T12:00:00.000Z"),
    updatedAt: new Date("2026-06-24T12:00:00.000Z"),
    ...overrides
  };
}

function prismaUniqueConstraintError() {
  return { code: "P2002", name: "PrismaClientKnownRequestError", message: "Unique constraint failed" };
}

describe("upsertSharedRecord", () => {
  it("creates a new shared record when no legacy key exists yet", async () => {
    const createdRow = sharedRecordRow({ id: "created_1" });
    const database = {
      sharedBusinessRecord: {
        create: vi.fn<(_: Prisma.SharedBusinessRecordCreateArgs) => Promise<SharedBusinessRecordRow>>().mockResolvedValue(createdRow),
        findFirst: vi.fn(),
        update: vi.fn()
      }
    };

    const result = await upsertSharedRecord(
      "org_test",
      {
        entityType: "CUSTOMER",
        displayName: "Acme Learning",
        status: "ACTIVE",
        sourceApp: "ecrm",
        ecrmLegacyId: "lead_1"
      },
      database
    );

    expect(result.created).toBe(true);
    expect(result.record.id).toBe("created_1");
    expect(database.sharedBusinessRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: "CUSTOMER",
        ecrmLegacyId: "lead_1",
        searchText: "acme learning active lead_1"
      })
    });
    expect(database.sharedBusinessRecord.update).not.toHaveBeenCalled();
  });

  it("updates the existing legacy record when create hits a duplicate key after a stale miss", async () => {
    const existingRow = sharedRecordRow({ id: "existing_1", displayName: "Old name" });
    const updatedRow = sharedRecordRow({
      id: "existing_1",
      displayName: "New name",
      status: "ACTIVE",
      searchText: "new name active lead_1"
    });
    const database = {
      sharedBusinessRecord: {
        create: vi
          .fn<(_: Prisma.SharedBusinessRecordCreateArgs) => Promise<SharedBusinessRecordRow>>()
          .mockRejectedValue(prismaUniqueConstraintError()),
        findFirst: vi
          .fn<(_: Prisma.SharedBusinessRecordFindFirstArgs) => Promise<SharedBusinessRecordRow | null>>()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(existingRow),
        update: vi.fn<(_: Prisma.SharedBusinessRecordUpdateArgs) => Promise<SharedBusinessRecordRow>>().mockResolvedValue(updatedRow)
      }
    };

    await expect(
      upsertSharedRecord(
        "org_test",
        {
          entityType: "CUSTOMER",
          displayName: "New name",
          status: "ACTIVE",
          sourceApp: "ecrm",
          ecrmLegacyId: "lead_1"
        },
        database
      )
    ).resolves.toMatchObject({
      created: false,
      record: {
        id: "existing_1",
        displayName: "New name",
        searchText: "new name active lead_1"
      }
    });
    expect(database.sharedBusinessRecord.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        organizationId: "org_test",
        entityType: "CUSTOMER",
        ecrmLegacyId: "lead_1"
      }
    });
    expect(database.sharedBusinessRecord.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        organizationId: "org_test",
        entityType: "CUSTOMER",
        ecrmLegacyId: "lead_1"
      }
    });
    expect(database.sharedBusinessRecord.update).toHaveBeenCalledWith({
      where: { id: "existing_1" },
      data: expect.objectContaining({
        displayName: "New name",
        searchText: "new name active lead_1"
      })
    });
  });

  it("falls back to emailvoice legacy matching when an ecrm legacy key has no match", async () => {
    const existingRow = sharedRecordRow({
      id: "existing_emailvoice_1",
      ecrmLegacyId: null,
      emailVoiceLegacyId: "emailvoice_contact_1"
    });
    const updatedRow = sharedRecordRow({
      id: "existing_emailvoice_1",
      ecrmLegacyId: "lead_1",
      emailVoiceLegacyId: "emailvoice_contact_1",
      displayName: "Linked customer",
      searchText: "linked customer active lead_1 emailvoice_contact_1"
    });
    const database = {
      sharedBusinessRecord: {
        create: vi.fn(),
        findFirst: vi
          .fn<(_: Prisma.SharedBusinessRecordFindFirstArgs) => Promise<SharedBusinessRecordRow | null>>()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(existingRow),
        update: vi.fn<(_: Prisma.SharedBusinessRecordUpdateArgs) => Promise<SharedBusinessRecordRow>>().mockResolvedValue(updatedRow)
      }
    };

    const result = await upsertSharedRecord(
      "org_test",
      {
        entityType: "CUSTOMER",
        displayName: "Linked customer",
        status: "ACTIVE",
        sourceApp: "ecrm",
        ecrmLegacyId: "lead_1",
        emailVoiceLegacyId: "emailvoice_contact_1"
      },
      database
    );

    expect(result.created).toBe(false);
    expect(database.sharedBusinessRecord.create).not.toHaveBeenCalled();
    expect(database.sharedBusinessRecord.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        organizationId: "org_test",
        entityType: "CUSTOMER",
        emailVoiceLegacyId: "emailvoice_contact_1"
      }
    });
  });

  it("updates an existing shared record by external key when legacy ids are absent", async () => {
    const existingRow = sharedRecordRow({
      id: "existing_external_1",
      ecrmLegacyId: null,
      emailVoiceLegacyId: null,
      externalKey: "emailvoice:lead:123"
    });
    const updatedRow = sharedRecordRow({
      id: "existing_external_1",
      ecrmLegacyId: null,
      emailVoiceLegacyId: null,
      externalKey: "emailvoice:lead:123",
      displayName: "Updated external lead",
      searchText: "updated external lead open emailvoice:lead:123"
    });
    const database = {
      sharedBusinessRecord: {
        create: vi.fn(),
        findFirst: vi.fn<(_: Prisma.SharedBusinessRecordFindFirstArgs) => Promise<SharedBusinessRecordRow | null>>().mockResolvedValue(existingRow),
        update: vi.fn<(_: Prisma.SharedBusinessRecordUpdateArgs) => Promise<SharedBusinessRecordRow>>().mockResolvedValue(updatedRow)
      }
    };

    const result = await upsertSharedRecord(
      "org_test",
      {
        entityType: "LEAD",
        displayName: "Updated external lead",
        status: "OPEN",
        sourceApp: "emailvoice",
        externalKey: "emailvoice:lead:123"
      },
      database
    );

    expect(result.created).toBe(false);
    expect(database.sharedBusinessRecord.create).not.toHaveBeenCalled();
    expect(database.sharedBusinessRecord.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: "org_test",
        entityType: "LEAD",
        externalKey: "emailvoice:lead:123"
      }
    });
    expect(database.sharedBusinessRecord.update).toHaveBeenCalledWith({
      where: { id: "existing_external_1" },
      data: expect.objectContaining({
        externalKey: "emailvoice:lead:123",
        searchText: "updated external lead open emailvoice:lead:123"
      })
    });
  });

  it("recovers from duplicate external key creates by refetching and updating", async () => {
    const existingRow = sharedRecordRow({
      id: "existing_external_2",
      ecrmLegacyId: null,
      emailVoiceLegacyId: null,
      externalKey: "external:order:777"
    });
    const updatedRow = sharedRecordRow({
      id: "existing_external_2",
      entityType: "ORDER",
      ecrmLegacyId: null,
      emailVoiceLegacyId: null,
      externalKey: "external:order:777",
      displayName: "Updated external order",
      searchText: "updated external order booked external:order:777"
    });
    const database = {
      sharedBusinessRecord: {
        create: vi
          .fn<(_: Prisma.SharedBusinessRecordCreateArgs) => Promise<SharedBusinessRecordRow>>()
          .mockRejectedValue(prismaUniqueConstraintError()),
        findFirst: vi
          .fn<(_: Prisma.SharedBusinessRecordFindFirstArgs) => Promise<SharedBusinessRecordRow | null>>()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(existingRow),
        update: vi.fn<(_: Prisma.SharedBusinessRecordUpdateArgs) => Promise<SharedBusinessRecordRow>>().mockResolvedValue(updatedRow)
      }
    };

    const result = await upsertSharedRecord(
      "org_test",
      {
        entityType: "ORDER",
        displayName: "Updated external order",
        status: "BOOKED",
        sourceApp: "ecrm",
        externalKey: "external:order:777"
      },
      database
    );

    expect(result.created).toBe(false);
    expect(database.sharedBusinessRecord.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        organizationId: "org_test",
        entityType: "ORDER",
        externalKey: "external:order:777"
      }
    });
    expect(database.sharedBusinessRecord.update).toHaveBeenCalledWith({
      where: { id: "existing_external_2" },
      data: expect.objectContaining({
        externalKey: "external:order:777",
        searchText: "updated external order booked external:order:777"
      })
    });
  });
});
