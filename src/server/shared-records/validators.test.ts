import { describe, expect, it } from "vitest";

import { sharedRecordUpsertSchema } from "./validators";

describe("sharedRecordUpsertSchema", () => {
  it("normalizes upsert input and defaults data", () => {
    const parsed = sharedRecordUpsertSchema.parse({
      entityType: "CUSTOMER",
      displayName: "  Acme Learning Pvt Ltd  ",
      status: "  ACTIVE  ",
      ownerId: " user_sales ",
      sourceApp: " ecrm ",
      ecrmLegacyId: " lead_1 ",
      email: " INFO@ACME.EXAMPLE ",
      phone: " +91 98765 43210 ",
      companyName: " Acme Learning "
    });

    expect(parsed).toEqual({
      entityType: "CUSTOMER",
      displayName: "Acme Learning Pvt Ltd",
      status: "ACTIVE",
      ownerId: "user_sales",
      sourceApp: "ecrm",
      ecrmLegacyId: "lead_1",
      email: "info@acme.example",
      phone: "+91 98765 43210",
      companyName: "Acme Learning",
      data: {}
    });
  });

  it("accepts emailvoice source records with arbitrary JSON data", () => {
    const parsed = sharedRecordUpsertSchema.parse({
      entityType: "CONTACT",
      displayName: "Anita Rao",
      status: "subscribed",
      sourceApp: "emailvoice",
      emailVoiceLegacyId: "contact_123",
      data: {
        tags: ["newsletter"],
        consent: true
      }
    });

    expect(parsed.data).toEqual({
      tags: ["newsletter"],
      consent: true
    });
  });

  it("rejects missing required fields and unsupported source apps", () => {
    const result = sharedRecordUpsertSchema.safeParse({
      entityType: "LEAD",
      displayName: " ",
      status: "",
      sourceApp: "portal"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.displayName).toContain("Enter a display name.");
      expect(result.error.flatten().fieldErrors.status).toContain("Enter a status.");
      expect(result.error.flatten().fieldErrors.sourceApp).toBeDefined();
    }
  });
});
