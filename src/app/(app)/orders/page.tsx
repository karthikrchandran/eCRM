import { OrderList } from "@/components/orders/order-list";
import { requireUser } from "@/server/auth/current-user";
import { listOrders } from "@/server/orders/queries";
import { listOrganizationUserOptions } from "@/server/organizations/member-options";
import { orderListFilterSchema } from "@/server/orders/validators";
import { redirect } from "next/navigation";

export default async function OrdersPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("orders");
  if (user.role === "SALES") {
    redirect("/performance");
  }

  const rawSearchParams = await searchParams;
  const filters = orderListFilterSchema.parse({
    financialYear: rawSearchParams.financialYear,
    ownerId: rawSearchParams.ownerId,
    quarter: rawSearchParams.quarter,
    status: rawSearchParams.status
  });
  const [orders, owners] = await Promise.all([
    listOrders(user, filters),
    listOrganizationUserOptions(user.organizationId, ["ADMIN", "SALES"])
  ]);

  return <OrderList filters={filters} orders={orders} owners={owners} />;
}
