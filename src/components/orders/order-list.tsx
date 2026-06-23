import Link from "next/link";
import type { OrderRecord } from "@/server/orders/queries";
import type { OrderListFilters } from "@/server/orders/types";

type OrderListProps = {
  filters: OrderListFilters;
  orders: OrderRecord[];
};

function formatPaisa(value: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(value / 100)}`;
}

const orderStatuses = ["DRAFT", "BOOKED", "IN_PRODUCTION", "READY_FOR_DELIVERY", "DELIVERED", "CANCELLED"] as const;

function yearOptions() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, index) => currentYear - index);
}

export function OrderList({ filters, orders }: OrderListProps) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Booked orders from accepted proposals.</p>
      </header>

      <form action="/orders" className="surface grid gap-4 p-4 md:grid-cols-4" method="get">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Financial year
          <select className="crm-control" defaultValue={filters.financialYear?.toString() ?? ""} name="financialYear">
            <option value="">All years</option>
            {yearOptions().map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Quarter
          <select className="crm-control" defaultValue={filters.quarter?.toString() ?? ""} name="quarter">
            <option value="">Full year</option>
            <option value="1">Q1 Jan-Mar</option>
            <option value="2">Q2 Apr-Jun</option>
            <option value="3">Q3 Jul-Sep</option>
            <option value="4">Q4 Oct-Dec</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Status
          <select className="crm-control" defaultValue={filters.status ?? ""} name="status">
            <option value="">All statuses</option>
            {orderStatuses.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <button className="crm-button crm-button-primary text-sm" type="submit">
            Apply filters
          </button>
          <Link className="crm-button crm-button-secondary text-sm" href="/orders">
            Reset
          </Link>
        </div>
      </form>

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
