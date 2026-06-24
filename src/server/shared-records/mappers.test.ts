import { describe, expect, it } from "vitest";

import { buildSearchText, mapSharedRecordRow } from "./mappers";
import type { SharedBusinessRecordRow } from "./types";

describe("shared record mappers", () => {
  it("builds normalized search text from identifying fields", () => {
    expect(
      buildSearchText({
        displayName: " Acme Learning ",
        status: " ACTIVE ",
        email: " INFO@ACME.EXAMPLE ",
        phone: " +91 98765 43210 ",
        companyName: " Acme Group ",
        externalKey: " EXT-42 ",
        ecrmLegacyId: " lead_1 ",
        emailVoiceLegacyId: undefined
      })
    ).toBe("acme learning active info@acme.example +91 98765 43210 acme group ext-42 lead_1");
  });

  it("maps a database row to an API DTO", () => {
    const row: SharedBusinessRecordRow = {
      id: "shared_1",
      entityType: "CUSTOMER",
      displayName: "Acme Learning",
      status: "ACTIVE",
      ownerId: "user_sales",
      parentId: null,
      relatedLeadId: "lead_1",
      relatedCustomerId: null,
      relatedContactId: null,
      relatedOpportunityId: null,
      sourceApp: "ecrm",
      ecrmLegacyId: "lead_1",
      emailVoiceLegacyId: null,
      externalKey: null,
      email: "info@acme.example",
      phone: null,
      companyName: "Acme Group",
      searchText: "acme learning active",
      data: { tier: "gold" },
      archivedAt: null,
      createdAt: new Date("2026-06-24T12:00:00.000Z"),
      updatedAt: new Date("2026-06-24T12:30:00.000Z")
    };

    expect(mapSharedRecordRow(row)).toEqual({
      ...row,
      createdAt: "2026-06-24T12:00:00.000Z",
      updatedAt: "2026-06-24T12:30:00.000Z",
      archivedAt: null
    });
  });
});
