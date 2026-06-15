import { revalidatePath } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { LEAD_IMPORT_HEADERS, MAX_IMPORT_FILE_BYTES } from "./lead-import";
import { handleLeadImportActionForTest } from "./lead-import-actions";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

const actor = { id: "user_admin", role: "ADMIN" as const };
const csvText = `${LEAD_IMPORT_HEADERS.join(",")}\nAcme,LEAD,sales@example.com,,,,,,,,,,,,,,,,,,,,`;

function formData(file: File, intent: "preview" | "import") {
  const data = new FormData();
  data.set("csvFile", file);
  data.set("intent", intent);
  data.set("acceptedRows", JSON.stringify([{ rowNumber: 2 }]));
  return data;
}

describe("lead import actions", () => {
  it("previews from the uploaded CSV file without trusting accepted rows from the client", async () => {
    const preview = vi.fn().mockResolvedValue({
      totalRows: 1,
      validRows: 1,
      rows: [{ rowNumber: 2, lead: { name: "Acme" }, ownerEmail: "sales@example.com" }],
      errors: []
    });
    const importCsv = vi.fn();

    const result = await handleLeadImportActionForTest(actor, formData(new File([csvText], "leads.csv", { type: "text/csv" }), "preview"), {
      preview,
      importCsv
    });

    expect(result).toMatchObject({ ok: true, mode: "preview", totalRows: 1, validRows: 1 });
    expect(preview).toHaveBeenCalledWith(actor, csvText);
    expect(importCsv).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("imports by reparsing the uploaded CSV file server-side and revalidates lead pages", async () => {
    const preview = vi.fn();
    const importCsv = vi.fn().mockResolvedValue({
      totalRows: 1,
      importedRows: 1,
      skippedRows: 0,
      errors: []
    });

    const result = await handleLeadImportActionForTest(actor, formData(new File([csvText], "leads.csv", { type: "text/csv" }), "import"), {
      preview,
      importCsv
    });

    expect(result).toMatchObject({ ok: true, mode: "import", totalRows: 1, importedRows: 1, skippedRows: 0 });
    expect(importCsv).toHaveBeenCalledWith(actor, csvText);
    expect(preview).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/leads");
    expect(revalidatePath).toHaveBeenCalledWith("/leads/import");
  });

  it("caps uploaded CSV file size before calling preview or import services", async () => {
    const preview = vi.fn();
    const importCsv = vi.fn();
    const oversizedFile = new File(["x".repeat(MAX_IMPORT_FILE_BYTES + 1)], "too-large.csv", { type: "text/csv" });

    const result = await handleLeadImportActionForTest(actor, formData(oversizedFile, "preview"), { preview, importCsv });

    expect(result).toEqual({
      ok: false,
      mode: "preview",
      message: `Upload a CSV file no larger than ${MAX_IMPORT_FILE_BYTES} bytes.`,
      errors: []
    });
    expect(preview).not.toHaveBeenCalled();
    expect(importCsv).not.toHaveBeenCalled();
  });
});
