import { OrderList } from "@/components/orders/order-list";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { listOrders } from "@/server/orders/queries";
import { orderListFilterSchema } from "@/server/orders/validators";
import { redirect } from "next/navigation";

export default async function OrdersPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
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
    db.user.findMany({
      where: { active: true, role: { in: ["ADMIN", "SALES"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true }
    })
  ]);

  return <OrderList filters={filters} orders={orders} owners={owners} />;
}
