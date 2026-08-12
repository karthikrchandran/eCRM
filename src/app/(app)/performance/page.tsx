import { RepComparisonTable } from "@/components/performance/rep-comparison-table";
import { SalesPerformance } from "@/components/performance/sales-performance";
import { requireUser } from "@/server/auth/current-user";
import { listIncentives } from "@/server/finance/incentives-queries";
import { listOrders } from "@/server/orders/queries";
import { listRepPerformanceSummaries, listSalesRepOptions } from "@/server/reports/rep-performance-queries";

function parseOptionalNumber(value: string | string[] | undefined) {
  if (value === undefined) {
    return undefined;
  }

  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function PerformancePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("reports");
  const rawSearchParams = await searchParams;
  const filters = {
    financialYear: parseOptionalNumber(rawSearchParams.financialYear),
    quarter: parseOptionalNumber(rawSearchParams.quarter) as 1 | 2 | 3 | 4 | undefined,
    ownerId: user.id
  };

  if (user.role === "ADMIN") {
    const teamFilters = {
      financialYear: filters.financialYear,
      ownerId: Array.isArray(rawSearchParams.ownerId) ? rawSearchParams.ownerId[0] : rawSearchParams.ownerId,
      quarter: filters.quarter
    };
    const [rows, repOptions] = await Promise.all([listRepPerformanceSummaries(user, teamFilters), listSalesRepOptions(user)]);
    return <RepComparisonTable filters={teamFilters} repOptions={repOptions} rows={rows} />;
  }

  const [orders, incentives] = await Promise.all([
    listOrders(user, filters),
    listIncentives(user, filters)
  ]);

  return <SalesPerformance filters={filters} incentives={incentives} orders={orders} />;
}
