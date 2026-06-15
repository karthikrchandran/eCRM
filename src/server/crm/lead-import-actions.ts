import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import type { CrmUser } from "./permissions";
import {
  MAX_IMPORT_FILE_BYTES,
  importLeadCsv,
  previewLeadImportCsv,
  type LeadImportPreparedRow,
  type LeadImportResult,
  type LeadImportRowError
} from "./lead-import";

export type LeadImportActionState = {
  ok: boolean;
  mode?: "preview" | "import";
  message?: string;
  totalRows?: number;
  validRows?: number;
  importedRows?: number;
  skippedRows?: number;
  rows?: LeadImportPreparedRow[];
  errors?: LeadImportRowError[];
};

type LeadImportActionServices = {
  preview: (user: CrmUser, csvText: string) => Promise<{
    totalRows: number;
    validRows: number;
    rows: LeadImportPreparedRow[];
    errors: LeadImportRowError[];
  }>;
  importCsv: (user: CrmUser, csvText: string) => Promise<LeadImportResult>;
};

const defaultServices: LeadImportActionServices = {
  preview: previewLeadImportCsv,
  importCsv: importLeadCsv
};

function normalizeIntent(formData: FormData): "preview" | "import" {
  return formData.get("intent") === "import" ? "import" : "preview";
}

async function readCsvText(formData: FormData, mode: "preview" | "import") {
  const file = formData.get("csvFile");

  if (!(file instanceof File) || file.size === 0) {
    return {
      ok: false as const,
      state: {
        ok: false,
        mode,
        message: "Choose a CSV file to upload.",
        errors: []
      } satisfies LeadImportActionState
    };
  }

  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return {
      ok: false as const,
      state: {
        ok: false,
        mode,
        message: `Upload a CSV file no larger than ${MAX_IMPORT_FILE_BYTES} bytes.`,
        errors: []
      } satisfies LeadImportActionState
    };
  }

  return { ok: true as const, csvText: await file.text() };
}

export async function handleLeadImportActionForTest(
  user: CrmUser,
  formData: FormData,
  services: LeadImportActionServices = defaultServices
): Promise<LeadImportActionState> {
  const mode = normalizeIntent(formData);
  const fileResult = await readCsvText(formData, mode);

  if (!fileResult.ok) {
    return fileResult.state;
  }

  if (mode === "preview") {
    const result = await services.preview(user, fileResult.csvText);
    return {
      ok: result.errors.length === 0,
      mode,
      message:
        result.errors.length === 0
          ? `${result.validRows} of ${result.totalRows} rows are ready to import.`
          : `${result.errors.length} row error${result.errors.length === 1 ? "" : "s"} found.`,
      totalRows: result.totalRows,
      validRows: result.validRows,
      rows: result.rows,
      errors: result.errors
    };
  }

  const result = await services.importCsv(user, fileResult.csvText);
  revalidatePath("/leads");
  revalidatePath("/leads/import");

  return {
    ok: result.errors.length === 0,
    mode,
    message:
      result.errors.length === 0
        ? `${result.importedRows} row${result.importedRows === 1 ? "" : "s"} imported.`
        : `${result.importedRows} row${result.importedRows === 1 ? "" : "s"} imported; ${result.errors.length} error${
            result.errors.length === 1 ? "" : "s"
          } found.`,
    totalRows: result.totalRows,
    importedRows: result.importedRows,
    skippedRows: result.skippedRows,
    errors: result.errors
  };
}

export async function leadImportAction(_previousState: LeadImportActionState, formData: FormData): Promise<LeadImportActionState> {
  "use server";

  const user = await requireUser();
  return handleLeadImportActionForTest(user, formData);
}
