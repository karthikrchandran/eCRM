import { OrderList } from "@/components/orders/order-list";
import { requireUser } from "@/server/auth/current-user";
import { listOrders } from "@/server/orders/queries";

export default async function OrdersPage() {
  const user = await requireUser();
  const orders = await listOrders(user);

  return <OrderList orders={orders} />;
}
