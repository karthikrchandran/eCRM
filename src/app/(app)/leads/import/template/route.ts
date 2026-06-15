import { buildLeadImportTemplateCsv } from "@/server/crm/lead-import";

export function GET() {
  return new Response(buildLeadImportTemplateCsv(), {
    headers: {
      "Content-Disposition": 'attachment; filename="lead-import-template.csv"',
      "Content-Type": "text/csv; charset=utf-8"
    }
  });
}
