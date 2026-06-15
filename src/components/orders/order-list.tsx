import Link from "next/link";
import type { OrderRecord } from "@/server/orders/queries";

type OrderListProps = {
  orders: OrderRecord[];
};

function formatPaisa(value: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(value / 100)}`;
}

export function OrderList({ orders }: OrderListProps) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Booked orders from accepted proposals.</p>
      </header>

      {orders.length === 0 ? <p className="surface p-4 text-sm text-[var(--muted)]">No orders booked yet.</p> : null}
      <div className="space-y-3">
        {orders.map((order) => (
          <article className="surface p-4" key={order.id}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Link className="font-semibold text-[var(--accent-strong)] hover:underline" href={`/orders/${order.id}`}>
                  {order.orderNumber}
                </Link>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {order.leadCustomer.name} - {order.opportunity.title} - {order.status}
                </p>
              </div>
              <p className="font-semibold">{formatPaisa(order.totalPaisa, order.currency)}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
