import Link from "next/link";
import { LeadImportForm } from "@/components/crm/lead-import-form";
import { requireUser } from "@/server/auth/current-user";
import { leadImportAction } from "@/server/crm/lead-import-actions";
import { assertCanWriteCrmRecords } from "@/server/crm/permissions";

export default async function LeadImportPage() {
  const user = await requireUser();
  assertCanWriteCrmRecords(user);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Import leads</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Upload the fixed CRM lead template.</p>
        </div>
        <Link className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-semibold" href="/leads">
          Back to leads
        </Link>
      </header>

      <LeadImportForm action={leadImportAction} />
    </div>
  );
}
