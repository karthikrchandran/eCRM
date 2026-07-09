import { redirect } from "next/navigation";
import { SalesPerformance } from "@/components/performance/sales-performance";
import { requireUser } from "@/server/auth/current-user";
import { listIncentives } from "@/server/finance/incentives-queries";
import { listOrders } from "@/server/orders/queries";

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
  const user = await requireUser();
  if (user.role === "ADMIN") {
    redirect("/orders");
  }

  const rawSearchParams = await searchParams;
  const filters = {
    financialYear: parseOptionalNumber(rawSearchParams.financialYear),
    quarter: parseOptionalNumber(rawSearchParams.quarter) as 1 | 2 | 3 | 4 | undefined,
    ownerId: user.id
  };

  const [orders, incentives] = await Promise.all([
    listOrders(user, filters),
    listIncentives(user, filters)
  ]);

  return <SalesPerformance filters={filters} incentives={incentives} orders={orders} />;
}
