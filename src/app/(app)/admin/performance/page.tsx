import { notFound } from "next/navigation";
import { RepComparisonTable } from "@/components/performance/rep-comparison-table";
import { requireUser } from "@/server/auth/current-user";
import { canManageAdminSettings } from "@/server/auth/permissions";
import { listRepPerformanceSummaries, listSalesRepOptions } from "@/server/reports/rep-performance-queries";

function parseOptionalNumber(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function AdminPerformancePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("reports");

  if (!canManageAdminSettings(user.role)) {
    notFound();
  }

  const rawSearchParams = await searchParams;
  const filters = {
    financialYear: parseOptionalNumber(rawSearchParams.financialYear),
    ownerId: Array.isArray(rawSearchParams.ownerId) ? rawSearchParams.ownerId[0] : rawSearchParams.ownerId,
    quarter: parseOptionalNumber(rawSearchParams.quarter) as 1 | 2 | 3 | 4 | undefined
  };

  const [rows, repOptions] = await Promise.all([listRepPerformanceSummaries(user, filters), listSalesRepOptions(user)]);

  return <RepComparisonTable filters={filters} repOptions={repOptions} rows={rows} />;
}
