import { OrderList } from "@/components/orders/order-list";
import { requireUser } from "@/server/auth/current-user";
import { listOrders } from "@/server/orders/queries";
import { orderListFilterSchema } from "@/server/orders/validators";

export default async function OrdersPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const rawSearchParams = await searchParams;
  const filters = orderListFilterSchema.parse({
    financialYear: rawSearchParams.financialYear,
    quarter: rawSearchParams.quarter,
    status: rawSearchParams.status
  });
  const orders = await listOrders(user, filters);

  return <OrderList filters={filters} orders={orders} />;
}
