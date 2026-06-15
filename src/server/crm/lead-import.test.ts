import { describe, expect, it, vi } from "vitest";
import {
  LEAD_IMPORT_HEADERS,
  MAX_IMPORT_ROWS,
  importLeadCsv,
  previewLeadImportCsv,
  type LeadImportDatabase
} from "./lead-import";

const actor = { id: "user_admin", role: "ADMIN" as const };

function csv(rows: string[][]) {
  return [LEAD_IMPORT_HEADERS.join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n");
}

function csvCell(value: string) {
  return value.includes(",") || value.includes("\"") || value.includes("\n") ? `"${value.replaceAll("\"", "\"\"")}"` : value;
}

function ownerDb(owner: { id: string } | null = { id: "user_sales" }) {
  return {
    user: {
      findFirst: vi.fn().mockResolvedValue(owner)
    }
  } as unknown as LeadImportDatabase;
}

describe("lead CSV import", () => {
  it("previews fixed-template rows with normalized lead, branch, and contact data", async () => {
    const result = await previewLeadImportCsv(
      actor,
      csv([
        [
          " Acme Learning, Pvt Ltd ",
          "CUSTOMER",
          "Sales@Example.com",
          " Education ",
          " Referral ",
          " strategic account ",
          " Bengaluru HQ ",
          " 12 MG Road ",
          "",
          " Bengaluru ",
          " KA ",
          " 560001 ",
          "",
          " 29ABCDE1234F1Z5 ",
          " Near metro ",
          " Renewal due ",
          " branch note ",
          " Anita Rao ",
          " Procurement Head ",
          " Anita@Example.com ",
          " +91 99999 11111 ",
          " yes ",
          " main buyer "
        ]
      ]),
      ownerDb()
    );

    expect(result.errors).toEqual([]);
    expect(result.totalRows).toBe(1);
    expect(result.validRows).toBe(1);
    expect(result.rows[0]).toMatchObject({
      rowNumber: 2,
      ownerEmail: "sales@example.com",
      lead: {
        name: "Acme Learning, Pvt Ltd",
        state: "CUSTOMER",
        ownerId: "user_sales",
        industry: "Education",
        source: "Referral",
        notes: "strategic account"
      },
      branch: {
        name: "Bengaluru HQ",
        addressLine1: "12 MG Road",
        city: "Bengaluru",
        region: "KA",
        postalCode: "560001",
        country: "India",
        gstin: "29ABCDE1234F1Z5",
        locationHint: "Near metro",
        salesContext: "Renewal due",
        notes: "branch note"
      },
      contact: {
        name: "Anita Rao",
        designation: "Procurement Head",
        email: "anita@example.com",
        phone: "+91 99999 11111",
        isPrimary: true,
        notes: "main buyer"
      }
    });
  });

  it("returns row-numbered field errors for invalid fixed-template data", async () => {
    const result = await previewLeadImportCsv(
      actor,
      csv([
        [
          "",
          "PROSPECT",
          "missing-owner@example.com",
          "",
          "",
          "",
          "Branch without contact",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "not-an-email",
          "",
          "maybe",
          ""
        ]
      ]),
      ownerDb(null)
    );

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        { rowNumber: 2, field: "leadName", reason: "Enter a lead or customer name." },
        { rowNumber: 2, field: "state", reason: "Choose LEAD, CUSTOMER, or DORMANT." },
        { rowNumber: 2, field: "ownerEmail", reason: "Choose an active Admin or Sales owner." },
        { rowNumber: 2, field: "contactEmail", reason: "Enter a valid email address." },
        { rowNumber: 2, field: "isPrimaryContact", reason: "Use true/false, yes/no, or 1/0." },
        { rowNumber: 2, field: "contactName", reason: "Enter a contact name when contact fields are present." }
      ])
    );
  });

  it("reports invalid owner emails against the ownerEmail field", async () => {
    const result = await previewLeadImportCsv(
      actor,
      csv([
        [
          "Acme Learning",
          "LEAD",
          "not-an-email",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          ""
        ]
      ]),
      ownerDb()
    );

    expect(result.errors).toEqual([{ rowNumber: 2, field: "ownerEmail", reason: "Enter a valid email address." }]);
  });

  it("rejects files with incompatible headers before validating rows", async () => {
    const result = await previewLeadImportCsv(actor, `leadName,ownerEmail\nAcme,sales@example.com`, ownerDb());

    expect(result.totalRows).toBe(0);
    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      {
        rowNumber: 1,
        field: "headers",
        reason: `Use the fixed lead import template headers: ${LEAD_IMPORT_HEADERS.join(",")}.`
      }
    ]);
  });

  it("caps row count", async () => {
    const row = [
      "Acme",
      "LEAD",
      "sales@example.com",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      ""
    ];
    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => row);

    const result = await previewLeadImportCsv(actor, csv(rows), ownerDb());

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      {
        rowNumber: 0,
        field: "file",
        reason: `Import at most ${MAX_IMPORT_ROWS} rows at a time.`
      }
    ]);
  });

  it("imports each valid row inside its own transaction", async () => {
    const leadCreate = vi.fn().mockResolvedValue({ id: "lead_1" });
    const branchCreate = vi.fn().mockResolvedValue({ id: "branch_1" });
    const contactCreate = vi.fn().mockResolvedValue({ id: "contact_1" });
    const transaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        user: { findFirst: vi.fn().mockResolvedValue({ id: "user_sales" }) },
        leadCustomer: {
          create: leadCreate,
          findUnique: vi.fn().mockResolvedValue({ id: "lead_1" })
        },
        branch: {
          create: branchCreate,
          findFirst: vi.fn().mockResolvedValue({ id: "branch_1" })
        },
        contact: { create: contactCreate }
      })
    );
    const database = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: "user_sales" }) },
      $transaction: transaction
    } as unknown as LeadImportDatabase;

    const result = await importLeadCsv(
      actor,
      csv([
        [
          "Acme Learning",
          "LEAD",
          "sales@example.com",
          "Education",
          "Referral",
          "",
          "Bengaluru HQ",
          "",
          "",
          "Bengaluru",
          "",
          "",
          "India",
          "",
          "",
          "",
          "",
          "Anita Rao",
          "",
          "anita@example.com",
          "",
          "true",
          ""
        ]
      ]),
      database
    );

    expect(result).toMatchObject({ totalRows: 1, importedRows: 1, skippedRows: 0, errors: [] });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(leadCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Acme Learning",
        ownerId: "user_sales",
        createdById: "user_admin",
        updatedById: "user_admin"
      })
    });
    expect(branchCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ leadCustomerId: "lead_1", name: "Bengaluru HQ" })
    });
    expect(contactCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ leadCustomerId: "lead_1", branchId: "branch_1", name: "Anita Rao" })
    });
  });

  it("reports a failed branch/contact transaction without importing that row", async () => {
    const leadCreate = vi.fn().mockResolvedValue({ id: "lead_1" });
    const branchCreate = vi.fn().mockRejectedValue(new Error("Branch create failed"));
    const contactCreate = vi.fn();
    const transaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        user: { findFirst: vi.fn().mockResolvedValue({ id: "user_sales" }) },
        leadCustomer: {
          create: leadCreate,
          findUnique: vi.fn().mockResolvedValue({ id: "lead_1" })
        },
        branch: { create: branchCreate },
        contact: { create: contactCreate }
      })
    );
    const database = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: "user_sales" }) },
      $transaction: transaction
    } as unknown as LeadImportDatabase;

    const result = await importLeadCsv(
      actor,
      csv([
        [
          "Acme Learning",
          "LEAD",
          "sales@example.com",
          "",
          "",
          "",
          "Bengaluru HQ",
          "",
          "",
          "",
          "",
          "",
          "India",
          "",
          "",
          "",
          "",
          "Anita Rao",
          "",
          "",
          "",
          "false",
          ""
        ]
      ]),
      database
    );

    expect(result.importedRows).toBe(0);
    expect(result.skippedRows).toBe(1);
    expect(result.errors).toEqual([{ rowNumber: 2, field: "import", reason: "Branch create failed" }]);
    expect(leadCreate).toHaveBeenCalledOnce();
    expect(branchCreate).toHaveBeenCalledOnce();
    expect(contactCreate).not.toHaveBeenCalled();
  });
});
