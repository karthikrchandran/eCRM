import Link from "next/link";
import type { OrderRecord } from "@/server/orders/queries";
import type { IncentiveListFilters, IncentiveListRecord } from "@/server/finance/incentives-queries";
import { calculateOrderPaymentSummary } from "@/server/finance/calculations";
import { formatCurrencyPaisa } from "@/components/reports/report-formatters";

type SalesPerformanceProps = {
  filters: IncentiveListFilters;
  incentives: IncentiveListRecord[];
  orders: OrderRecord[];
};

function yearOptions() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, index) => currentYear - index);
}

function formatDate(date: Date | null) {
  return date ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date) : "Not set";
}

export function SalesPerformance({ filters, incentives, orders }: SalesPerformanceProps) {
  const summaryCurrency = (orders[0]?.currency as "INR" | "USD" | undefined) ?? "INR";
  const summary = orders.reduce(
    (acc, order) => {
      const paymentSummary = calculateOrderPaymentSummary(order.totalPaisa, order.invoices, order.payments);
      acc.bookedPaisa += order.totalPaisa;
      acc.collectedPaisa += paymentSummary.collectedPaisa;
      acc.pendingReceivablePaisa += paymentSummary.pendingReceivablePaisa;
      return acc;
    },
    { bookedPaisa: 0, collectedPaisa: 0, pendingReceivablePaisa: 0 }
  );
  const payableIncentivePaisa = incentives.reduce((total, incentive) => total + incentive.payableAmountPaisa, 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Sales performance</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Your bookings, collections, and incentive status in one place.</p>
      </header>

      <form action="/performance" className="surface grid gap-4 p-4 md:grid-cols-4" method="get">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Financial year
          <select className="crm-control" defaultValue={filters.financialYear?.toString() ?? ""} name="financialYear">
            <option value="">This year</option>
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
            <option value="">All quarters</option>
            <option value="1">Q1 Jan-Mar</option>
            <option value="2">Q2 Apr-Jun</option>
            <option value="3">Q3 Jul-Sep</option>
            <option value="4">Q4 Oct-Dec</option>
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <button className="crm-button crm-button-primary text-sm" type="submit">
            Apply filters
          </button>
          <Link className="crm-button crm-button-secondary text-sm" href="/performance">
            Reset
          </Link>
        </div>
      </form>

      <section className="grid gap-3 md:grid-cols-3">
        <article className="surface p-4">
          <p className="text-xs uppercase text-[var(--muted)]">Booked value</p>
          <p className="mt-2 text-2xl font-semibold">{formatCurrencyPaisa(summary.bookedPaisa, summaryCurrency)}</p>
        </article>
        <article className="surface p-4">
          <p className="text-xs uppercase text-[var(--muted)]">Collected</p>
          <p className="mt-2 text-2xl font-semibold">{formatCurrencyPaisa(summary.collectedPaisa, summaryCurrency)}</p>
        </article>
        <article className="surface p-4">
          <p className="text-xs uppercase text-[var(--muted)]">Incentives payable</p>
          <p className="mt-2 text-2xl font-semibold">{formatCurrencyPaisa(payableIncentivePaisa, summaryCurrency)}</p>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="surface p-4">
          <h2 className="text-lg font-semibold">Orders</h2>
          {orders.length === 0 ? <p className="mt-3 text-sm text-[var(--muted)]">No orders in this period.</p> : null}
          <div className="mt-3 space-y-3">
            {orders.map((order) => {
              const paymentSummary = calculateOrderPaymentSummary(order.totalPaisa, order.invoices, order.payments);

              return (
                <article className="rounded-md border border-[var(--border)] p-3 text-sm" key={order.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-950">{order.orderNumber}</p>
                      <p className="text-[var(--muted)]">
                        {order.leadCustomer.name} - {order.status}
                      </p>
                    </div>
                    <p className="font-semibold">{formatCurrencyPaisa(order.totalPaisa, order.currency as "INR" | "USD")}</p>
                  </div>
                  <p className="mt-2 text-[var(--muted)]">
                    Collected {formatCurrencyPaisa(paymentSummary.collectedPaisa, order.currency as "INR" | "USD")}, pending {formatCurrencyPaisa(paymentSummary.pendingReceivablePaisa, order.currency as "INR" | "USD")}
                  </p>
                  <Link className="mt-2 inline-block font-semibold text-[var(--brand-navy)]" href={`/orders/${order.id}`}>
                    Open finance summary
                  </Link>
                </article>
              );
            })}
          </div>
        </div>

        <div className="surface p-4">
          <h2 className="text-lg font-semibold">Incentives</h2>
          {incentives.length === 0 ? <p className="mt-3 text-sm text-[var(--muted)]">No incentives in this period.</p> : null}
          <div className="mt-3 space-y-3">
            {incentives.map((incentive) => (
              <article className="rounded-md border border-[var(--border)] p-3 text-sm" key={incentive.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-950">{incentive.order.orderNumber}</p>
                    <p className="text-[var(--muted)]">
                      {incentive.status} - {incentive.order.leadCustomer.name}
                    </p>
                  </div>
                  <p className="font-semibold">{formatCurrencyPaisa(incentive.payableAmountPaisa, incentive.order.currency as "INR" | "USD")}</p>
                </div>
                <p className="mt-2 text-[var(--muted)]">{incentive.readinessReason ?? "Ready for review"}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Approved {formatDate(incentive.approvedAt)} - Paid {formatDate(incentive.paidAt)}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
