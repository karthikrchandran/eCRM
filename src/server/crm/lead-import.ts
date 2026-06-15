import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/server/db";
import { assertCanWriteCrmRecords, type CrmUser } from "./permissions";
import { createBranch, createContact, createLeadCustomer } from "./mutations";
import type { BranchInput, ContactInput, LeadCustomerInput } from "./types";
import { branchInputSchema, contactInputSchema, leadCustomerInputSchema } from "./validators";

export const LEAD_IMPORT_HEADERS = [
  "leadName",
  "state",
  "ownerEmail",
  "industry",
  "source",
  "leadNotes",
  "branchName",
  "addressLine1",
  "addressLine2",
  "city",
  "region",
  "postalCode",
  "country",
  "gstin",
  "locationHint",
  "salesContext",
  "branchNotes",
  "contactName",
  "designation",
  "contactEmail",
  "contactPhone",
  "isPrimaryContact",
  "contactNotes"
] as const;

export const MAX_IMPORT_ROWS = 250;
export const MAX_IMPORT_FILE_BYTES = 256 * 1024;

type LeadImportHeader = (typeof LEAD_IMPORT_HEADERS)[number];
type IdResult = { id: string };
type LeadImportCsvRow = Record<LeadImportHeader, string>;
type BranchDraft = Omit<BranchInput, "leadCustomerId">;
type ContactDraft = Omit<ContactInput, "leadCustomerId" | "branchId">;

export type LeadImportRowError = {
  rowNumber: number;
  field: string;
  reason: string;
};

export type LeadImportPreparedRow = {
  rowNumber: number;
  ownerEmail: string;
  lead: LeadCustomerInput;
  branch?: BranchDraft;
  contact?: ContactDraft;
};

export type LeadImportPreviewResult = {
  totalRows: number;
  validRows: number;
  rows: LeadImportPreparedRow[];
  errors: LeadImportRowError[];
};

export type LeadImportResult = {
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  errors: LeadImportRowError[];
};

type OwnerLookupDb = {
  user: {
    findFirst: (args: Prisma.UserFindFirstArgs) => Promise<IdResult | null>;
  };
};

type LeadImportTransactionDb = OwnerLookupDb & {
  leadCustomer: {
    create: (args: Prisma.LeadCustomerCreateArgs) => Promise<IdResult>;
    findUnique: (args: Prisma.LeadCustomerFindUniqueArgs) => Promise<IdResult | null>;
  };
  branch: {
    create: (args: Prisma.BranchCreateArgs) => Promise<IdResult>;
    findFirst: (args: Prisma.BranchFindFirstArgs) => Promise<IdResult | null>;
  };
  contact: {
    create: (args: Prisma.ContactCreateArgs) => Promise<IdResult>;
  };
};

export type LeadImportDatabase = OwnerLookupDb & {
  $transaction?: (callback: (tx: LeadImportTransactionDb) => Promise<unknown>) => Promise<unknown>;
};

const ownerEmailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");

const csvFieldMap: Record<string, string> = {
  name: "leadName",
  state: "state",
  ownerId: "ownerEmail",
  notes: "leadNotes",
  email: "contactEmail",
  phone: "contactPhone",
  isPrimary: "isPrimaryContact"
};

const branchFieldMap: Record<string, string> = {
  name: "branchName",
  notes: "branchNotes"
};

const contactFieldMap: Record<string, string> = {
  name: "contactName",
  designation: "designation",
  email: "contactEmail",
  phone: "contactPhone",
  isPrimary: "isPrimaryContact",
  notes: "contactNotes"
};

function clean(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseCsv(text: string): { records: string[][]; error?: LeadImportRowError } {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let lastWasRecordBreak = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };

  const pushRecord = () => {
    pushCell();
    records.push(row);
    row = [];
    lastWasRecordBreak = true;
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === "\"") {
        if (text[index + 1] === "\"") {
          cell += "\"";
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += character;
      }
      continue;
    }

    if (character === "\"" && cell.length === 0) {
      inQuotes = true;
      lastWasRecordBreak = false;
      continue;
    }

    if (character === ",") {
      pushCell();
      lastWasRecordBreak = false;
      continue;
    }

    if (character === "\n") {
      pushRecord();
      continue;
    }

    if (character === "\r") {
      if (text[index + 1] === "\n") {
        index += 1;
      }
      pushRecord();
      continue;
    }

    cell += character;
    lastWasRecordBreak = false;
  }

  if (inQuotes) {
    return {
      records: [],
      error: { rowNumber: 0, field: "file", reason: "Close quoted CSV fields before uploading." }
    };
  }

  if (cell.length > 0 || row.length > 0 || (!lastWasRecordBreak && text.length > 0)) {
    pushCell();
    records.push(row);
  }

  return { records };
}

function normalizeHeaders(headers: string[]) {
  return headers.map((header, index) => {
    const trimmed = header.trim();
    return index === 0 ? trimmed.replace(/^\uFEFF/, "") : trimmed;
  });
}

function headersMatch(headers: string[]) {
  const normalized = normalizeHeaders(headers);
  return normalized.length === LEAD_IMPORT_HEADERS.length && LEAD_IMPORT_HEADERS.every((header, index) => normalized[index] === header);
}

function headerError(): LeadImportRowError {
  return {
    rowNumber: 1,
    field: "headers",
    reason: `Use the fixed lead import template headers: ${LEAD_IMPORT_HEADERS.join(",")}.`
  };
}

function toCsvRow(record: string[]) {
  return Object.fromEntries(LEAD_IMPORT_HEADERS.map((header, index) => [header, record[index] ?? ""])) as LeadImportCsvRow;
}

function addZodErrors(
  rowNumber: number,
  error: z.ZodError,
  errors: LeadImportRowError[],
  fieldMap: Record<string, string>
) {
  for (const issue of error.issues) {
    const path = issue.path[0]?.toString() ?? "";
    errors.push({
      rowNumber,
      field: fieldMap[path] ?? (path || "row"),
      reason: issue.message
    });
  }
}

function parseState(value: string, rowNumber: number, errors: LeadImportRowError[]) {
  const normalized = clean(value)?.toUpperCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized === "LEAD" || normalized === "CUSTOMER" || normalized === "DORMANT") {
    return normalized;
  }

  errors.push({ rowNumber, field: "state", reason: "Choose LEAD, CUSTOMER, or DORMANT." });
  return normalized;
}

function parsePrimaryContact(value: string, rowNumber: number, errors: LeadImportRowError[]) {
  const normalized = clean(value)?.toLowerCase();
  if (!normalized) {
    return false;
  }

  if (["true", "yes", "y", "1", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "no", "n", "0", "off"].includes(normalized)) {
    return false;
  }

  errors.push({ rowNumber, field: "isPrimaryContact", reason: "Use true/false, yes/no, or 1/0." });
  return false;
}

function hasBranchData(row: LeadImportCsvRow) {
  return [
    row.branchName,
    row.addressLine1,
    row.addressLine2,
    row.city,
    row.region,
    row.postalCode,
    row.country,
    row.gstin,
    row.locationHint,
    row.salesContext,
    row.branchNotes
  ].some((value) => Boolean(clean(value)));
}

function hasContactData(row: LeadImportCsvRow, isPrimary: boolean, primaryRaw: string) {
  return [
    row.contactName,
    row.designation,
    row.contactEmail,
    row.contactPhone,
    row.contactNotes
  ].some((value) => Boolean(clean(value))) || (isPrimary && Boolean(clean(primaryRaw)));
}

async function resolveOwner(database: OwnerLookupDb, ownerEmail: string) {
  return database.user.findFirst({
    where: { email: ownerEmail, active: true, role: { in: ["ADMIN", "SALES"] } },
    select: { id: true }
  });
}

async function prepareRow(
  user: CrmUser,
  rowNumber: number,
  row: LeadImportCsvRow,
  database: OwnerLookupDb
): Promise<{ row?: LeadImportPreparedRow; errors: LeadImportRowError[] }> {
  assertCanWriteCrmRecords(user);
  const errors: LeadImportRowError[] = [];
  const state = parseState(row.state, rowNumber, errors);
  const ownerEmailResult = ownerEmailSchema.safeParse(row.ownerEmail);
  const ownerEmail = ownerEmailResult.success ? ownerEmailResult.data : clean(row.ownerEmail)?.toLowerCase();

  if (!ownerEmailResult.success) {
    addZodErrors(rowNumber, ownerEmailResult.error, errors, { "": "ownerEmail" });
  }

  const owner = ownerEmailResult.success ? await resolveOwner(database, ownerEmailResult.data) : null;
  if (ownerEmailResult.success && !owner) {
    errors.push({ rowNumber, field: "ownerEmail", reason: "Choose an active Admin or Sales owner." });
  }

  const leadResult = leadCustomerInputSchema.safeParse({
    name: row.leadName,
    state,
    industry: row.industry,
    source: row.source,
    ownerId: owner?.id ?? "pending-owner",
    notes: row.leadNotes
  });

  if (!leadResult.success) {
    addZodErrors(rowNumber, leadResult.error, errors, csvFieldMap);
  }

  let branch: BranchDraft | undefined;
  const shouldCreateBranch = hasBranchData(row);
  if (shouldCreateBranch && !clean(row.branchName)) {
    errors.push({ rowNumber, field: "branchName", reason: "Enter a branch name when branch fields are present." });
  }

  if (shouldCreateBranch) {
    const branchResult = branchInputSchema.safeParse({
      leadCustomerId: "pending-lead",
      name: row.branchName,
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2,
      city: row.city,
      region: row.region,
      postalCode: row.postalCode,
      country: row.country,
      gstin: row.gstin,
      locationHint: row.locationHint,
      salesContext: row.salesContext,
      notes: row.branchNotes
    });

    if (branchResult.success) {
      branch = {
        name: branchResult.data.name,
        addressLine1: branchResult.data.addressLine1,
        addressLine2: branchResult.data.addressLine2,
        city: branchResult.data.city,
        region: branchResult.data.region,
        postalCode: branchResult.data.postalCode,
        country: branchResult.data.country,
        gstin: branchResult.data.gstin,
        locationHint: branchResult.data.locationHint,
        salesContext: branchResult.data.salesContext,
        notes: branchResult.data.notes
      };
    } else {
      addZodErrors(rowNumber, branchResult.error, errors, { ...csvFieldMap, ...branchFieldMap });
    }
  }

  const isPrimary = parsePrimaryContact(row.isPrimaryContact, rowNumber, errors);
  const shouldCreateContact = hasContactData(row, isPrimary, row.isPrimaryContact);
  if (shouldCreateContact && !clean(row.contactName)) {
    errors.push({ rowNumber, field: "contactName", reason: "Enter a contact name when contact fields are present." });
  }

  let contact: ContactDraft | undefined;
  if (shouldCreateContact) {
    const contactResult = contactInputSchema.safeParse({
      leadCustomerId: "pending-lead",
      branchId: branch ? "pending-branch" : undefined,
      name: row.contactName,
      designation: row.designation,
      email: row.contactEmail,
      phone: row.contactPhone,
      isPrimary,
      notes: row.contactNotes
    });

    if (contactResult.success) {
      contact = {
        name: contactResult.data.name,
        designation: contactResult.data.designation,
        email: contactResult.data.email,
        phone: contactResult.data.phone,
        isPrimary: contactResult.data.isPrimary,
        notes: contactResult.data.notes
      };
    } else {
      addZodErrors(rowNumber, contactResult.error, errors, { ...csvFieldMap, ...contactFieldMap });
    }
  }

  if (!leadResult.success || !owner || errors.length > 0) {
    return { errors };
  }

  return {
    row: {
      rowNumber,
      ownerEmail: ownerEmail ?? "",
      lead: leadResult.data,
      branch,
      contact
    },
    errors
  };
}

export async function previewLeadImportCsv(
  user: CrmUser,
  csvText: string,
  database: LeadImportDatabase = db as unknown as LeadImportDatabase
): Promise<LeadImportPreviewResult> {
  assertCanWriteCrmRecords(user);
  const parsed = parseCsv(csvText);

  if (parsed.error) {
    return { totalRows: 0, validRows: 0, rows: [], errors: [parsed.error] };
  }

  if (parsed.records.length === 0) {
    return { totalRows: 0, validRows: 0, rows: [], errors: [headerError()] };
  }

  const [headerRecord, ...dataRecords] = parsed.records;
  if (!headersMatch(headerRecord)) {
    return { totalRows: 0, validRows: 0, rows: [], errors: [headerError()] };
  }

  const nonEmptyRecords = dataRecords
    .map((record, index) => ({ record, rowNumber: index + 2 }))
    .filter(({ record }) => record.some((value) => Boolean(clean(value))));

  if (nonEmptyRecords.length > MAX_IMPORT_ROWS) {
    return {
      totalRows: nonEmptyRecords.length,
      validRows: 0,
      rows: [],
      errors: [{ rowNumber: 0, field: "file", reason: `Import at most ${MAX_IMPORT_ROWS} rows at a time.` }]
    };
  }

  const rows: LeadImportPreparedRow[] = [];
  const errors: LeadImportRowError[] = [];

  for (const { record, rowNumber } of nonEmptyRecords) {
    if (record.length > LEAD_IMPORT_HEADERS.length) {
      errors.push({
        rowNumber,
        field: "row",
        reason: `Expected ${LEAD_IMPORT_HEADERS.length} columns, found ${record.length}.`
      });
      continue;
    }

    const prepared = await prepareRow(user, rowNumber, toCsvRow(record), database);
    errors.push(...prepared.errors);

    if (prepared.row && prepared.errors.length === 0) {
      rows.push(prepared.row);
    }
  }

  return {
    totalRows: nonEmptyRecords.length,
    validRows: rows.length,
    rows,
    errors
  };
}

export async function importLeadCsv(
  user: CrmUser,
  csvText: string,
  database: LeadImportDatabase = db as unknown as LeadImportDatabase
): Promise<LeadImportResult> {
  assertCanWriteCrmRecords(user);
  const preview = await previewLeadImportCsv(user, csvText, database);
  const errors = [...preview.errors];
  let importedRows = 0;

  for (const row of preview.rows) {
    try {
      if (!database.$transaction) {
        throw new Error("CSV import requires transaction support.");
      }

      await database.$transaction(async (tx) => {
        const lead = await createLeadCustomer(user, row.lead, tx);
        let branchId: string | undefined;

        if (row.branch) {
          const branch = await createBranch(user, { ...row.branch, leadCustomerId: lead.id }, tx);
          branchId = branch.id;
        }

        if (row.contact) {
          await createContact(user, { ...row.contact, leadCustomerId: lead.id, branchId }, tx);
        }
      });
      importedRows += 1;
    } catch (error) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "import",
        reason: error instanceof Error && error.message ? error.message : "Import failed."
      });
    }
  }

  return {
    totalRows: preview.totalRows,
    importedRows,
    skippedRows: preview.totalRows - importedRows,
    errors
  };
}

export function buildLeadImportTemplateCsv() {
  return `${LEAD_IMPORT_HEADERS.join(",")}\n`;
}
