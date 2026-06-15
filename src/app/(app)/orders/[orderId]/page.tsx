import { notFound } from "next/navigation";
import { OrderDetail } from "@/components/orders/order-detail";
import { requireUser } from "@/server/auth/current-user";
import { instantiateProductionForOrderLineItemAction } from "@/server/production/actions";
import { getOrderFinanceSummary } from "@/server/finance/queries";
import { getOrderDetail } from "@/server/orders/queries";

export default async function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const user = await requireUser();
  const { orderId } = await params;
  const [finance, order] = await Promise.all([getOrderFinanceSummary(user, orderId), getOrderDetail(user, orderId)]);

  if (!order) {
    notFound();
  }

  const productionAction = instantiateProductionForOrderLineItemAction.bind(null, order.id);

  return <OrderDetail canManageFinance={user.role === "ADMIN"} finance={finance} instantiateProductionAction={productionAction} order={order} />;
}
