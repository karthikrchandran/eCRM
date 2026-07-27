import Link from "next/link";
import { formatCurrencyPaisa } from "@/components/reports/report-formatters";
import type { FinanceReports, TopBillingSummary } from "@/server/reports/types";

type CompanyFinanceOverviewProps = {
  currency: "INR" | "USD";
  finance: FinanceReports;
  topBillings: TopBillingSummary[];
};

function Money({ currency, value }: { currency: "INR" | "USD"; value: number }) {
  return <>{formatCurrencyPaisa(value, currency)}</>;
}

function Metric({ detail, label, value }: { detail: string; label: string; value: React.ReactNode }) {
  return (
    <article className="surface p-4">
      <p className="text-xs uppercase text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{detail}</p>
    </article>
  );
}

export function CompanyFinanceOverview({ currency, finance, topBillings }: CompanyFinanceOverviewProps) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Company financial performance</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Revenue, margin, collections, receivables, and incentive liability for the company.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Finance summary">
        <Metric detail="Revenue minus approved costs" label="Gross margin" value={<Money currency={currency} value={finance.grossMargin.grossMarginPaisa} />} />
        <Metric detail="Approved cost components" label="Approved cost" value={<Money currency={currency} value={finance.grossMargin.approvedCostPaisa} />} />
        <Metric detail="Unapproved non-void costs" label="Cost leakage" value={<Money currency={currency} value={finance.costLeakagePaisa} />} />
        <Metric detail="Ready or approved incentive value" label="Incentives payable" value={<Money currency={currency} value={finance.incentives.payablePaisa} />} />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="surface overflow-hidden">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <h2 className="text-lg font-semibold">Revenue and margin</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">How booked revenue is translating into gross margin.</p>
          </div>
          <dl className="divide-y divide-[var(--border)] text-sm">
            <div className="flex items-center justify-between gap-4 px-4 py-3"><dt>Revenue</dt><dd className="font-semibold"><Money currency={currency} value={finance.grossMargin.revenuePaisa} /></dd></div>
            <div className="flex items-center justify-between gap-4 px-4 py-3"><dt>Approved cost</dt><dd className="font-semibold"><Money currency={currency} value={finance.grossMargin.approvedCostPaisa} /></dd></div>
            <div className="flex items-center justify-between gap-4 px-4 py-3"><dt>Gross margin</dt><dd className="font-semibold"><Money currency={currency} value={finance.grossMargin.grossMarginPaisa} /></dd></div>
            <div className="flex items-center justify-between gap-4 px-4 py-3"><dt>Incentives paid</dt><dd className="font-semibold"><Money currency={currency} value={finance.incentives.paidPaisa} /></dd></div>
          </dl>
        </section>

        <section className="surface overflow-hidden">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <h2 className="text-lg font-semibold">Collections</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Outstanding invoices and receivables by age.</p>
          </div>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]">
              <tr><th className="px-4 py-3">Receivables age</th><th className="px-4 py-3">Invoices</th><th className="px-4 py-3 text-right">Outstanding</th></tr>
            </thead>
            <tbody>
              {finance.receivablesAging.map((bucket) => (
                <tr className="border-t border-[var(--border)]" key={bucket.bucket}>
                  <td className="px-4 py-3 font-medium">{bucket.bucket}</td>
                  <td className="px-4 py-3">{bucket.invoiceCount ?? 0}</td>
                  <td className="px-4 py-3 text-right"><Money currency={currency} value={bucket.outstandingPaisa ?? 0} /></td>
                </tr>
              ))}
              {finance.receivablesAging.length === 0 ? <tr><td className="px-4 py-3 text-[var(--muted)]" colSpan={3}>No open receivables.</td></tr> : null}
            </tbody>
          </table>
        </section>
      </div>

      <section className="surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div><h2 className="text-lg font-semibold">Company billings</h2><p className="mt-1 text-sm text-[var(--muted)]">Customers and orders contributing to booked revenue.</p></div>
          <Link className="crm-button crm-button-secondary text-sm" href="/reports">Open full reports</Link>
        </div>
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]"><tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3 text-right">Booked value</th></tr></thead>
          <tbody>
            {topBillings.map((billing) => (
              <tr className="border-t border-[var(--border)]" key={billing.orderId}>
                <td className="px-4 py-3"><Link className="font-medium text-[var(--accent-strong)] hover:underline" href={`/orders/${billing.orderId}`}>{billing.orderNumber}</Link></td>
                <td className="px-4 py-3">{billing.clientName}</td>
                <td className="px-4 py-3">{billing.ownerName}</td>
                <td className="px-4 py-3 text-right"><Money currency={currency} value={billing.bookedValuePaisa} /></td>
              </tr>
            ))}
            {topBillings.length === 0 ? <tr><td className="px-4 py-3 text-[var(--muted)]" colSpan={4}>No booked orders yet.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
