import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { listSharedRecords } from "./queries";
import type { SharedBusinessRecordRow } from "./types";

function sharedRecordRow(): SharedBusinessRecordRow {
  return {
    id: "shared_1",
    entityType: "CUSTOMER",
    displayName: "Acme Learning",
    status: "ACTIVE",
    ownerId: "user_sales",
    parentId: "parent_1",
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
    companyName: "Acme",
    searchText: "acme learning active",
    data: {},
    archivedAt: null,
    createdAt: new Date("2026-06-24T12:00:00.000Z"),
    updatedAt: new Date("2026-06-24T12:30:00.000Z")
  };
}

describe("listSharedRecords", () => {
  it("applies supported filters and excludes archived rows by default", async () => {
    const findMany = vi.fn<(_: Prisma.SharedBusinessRecordFindManyArgs) => Promise<SharedBusinessRecordRow[]>>().mockResolvedValue([sharedRecordRow()]);

    const result = await listSharedRecords(
      "org_test",
      {
        entityType: "CUSTOMER",
        q: " Acme ",
        status: "ACTIVE",
        parentId: "parent_1",
        limit: 10
      },
      {
        sharedBusinessRecord: {
          findMany,
          findFirst: vi.fn()
        }
      }
    );

    expect(findMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org_test",
        archivedAt: null,
        entityType: "CUSTOMER",
        status: "ACTIVE",
        parentId: "parent_1",
        searchText: { contains: "acme" }
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 10
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.createdAt).toBe("2026-06-24T12:00:00.000Z");
  });
});
