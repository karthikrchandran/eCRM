import { notFound } from "next/navigation";
import { OrderDetail } from "@/components/orders/order-detail";
import { requireUser } from "@/server/auth/current-user";
import { instantiateProductionForOrderLineItemAction } from "@/server/production/actions";
import { getOrderDetail } from "@/server/orders/queries";

export default async function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const user = await requireUser();
  const { orderId } = await params;
  const order = await getOrderDetail(user, orderId);

  if (!order) {
    notFound();
  }

  const productionAction = instantiateProductionForOrderLineItemAction.bind(null, order.id);

  return <OrderDetail instantiateProductionAction={productionAction} order={order} />;
}
