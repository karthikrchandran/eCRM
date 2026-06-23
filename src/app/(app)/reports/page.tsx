import Link from "next/link";
import { formatCurrencyPaisa, formatDate, formatNumber } from "@/components/reports/report-formatters";
import { requireUser } from "@/server/auth/current-user";
import { getReportsOverview } from "@/server/reports/queries";
import type { ReportsFilters } from "@/server/reports/types";

function getParam(searchParams: Record<string, string | string[] | undefined>, key: keyof ReportsFilters) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function getFilters(searchParams: Record<string, string | string[] | undefined>): ReportsFilters {
  return {
    currency: getParam(searchParams, "currency") as ReportsFilters["currency"],
    customerId: getParam(searchParams, "customerId"),
    dateFrom: getParam(searchParams, "dateFrom"),
    dateTo: getParam(searchParams, "dateTo"),
    ownerId: getParam(searchParams, "ownerId"),
    productServiceId: getParam(searchParams, "productServiceId"),
    stageId: getParam(searchParams, "stageId"),
    status: getParam(searchParams, "status")
  };
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td className="px-4 py-3 text-sm text-[var(--muted)]" colSpan={colSpan}>
        {label}
      </td>
    </tr>
  );
}

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="surface overflow-hidden">{children}</div>
    </section>
  );
}

function Money({ currency, value }: { currency: "INR" | "USD"; value: number }) {
  return <>{formatCurrencyPaisa(value, currency)}</>;
}

function ReportLink({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <Link className="font-medium text-[var(--accent-strong)] hover:underline" href={href}>
      {children}
    </Link>
  );
}

function MetricGrid({
  currency,
  metrics
}: {
  currency: "INR" | "USD";
  metrics: Array<{ detail: string; label: string; money?: boolean; value: number | string }>;
}) {
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label}>
          <p className="text-xs uppercase text-[var(--muted)]">{metric.label}</p>
          <p className="mt-1 text-xl font-semibold">
            {metric.money && typeof metric.value === "number" ? <Money currency={currency} value={metric.value} /> : metric.value}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">{metric.detail}</p>
        </div>
      ))}
    </div>
  );
}

export default async function ReportsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const rawSearchParams = await searchParams;
  const filters = getFilters(rawSearchParams);
  const reports = await getReportsOverview(user, undefined, filters);
  const currency = reports.currency;

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Company-wide reporting across sales, finance, production, customers, and product/service performance.
        </p>
      </section>

      <form className="surface grid gap-4 p-4 md:grid-cols-4" method="get">
        <label className="flex flex-col gap-1 text-sm font-medium">
          From
          <input className="crm-control" defaultValue={reports.filters.dateFrom ?? ""} name="dateFrom" type="date" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          To
          <input className="crm-control" defaultValue={reports.filters.dateTo ?? ""} name="dateTo" type="date" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Owner
          <select className="crm-control" defaultValue={reports.filters.ownerId ?? ""} name="ownerId">
            <option value="">All owners</option>
            {reports.filterOptions.owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Customer
          <select className="crm-control" defaultValue={reports.filters.customerId ?? ""} name="customerId">
            <option value="">All customers</option>
            {reports.filterOptions.customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Product/service
          <select className="crm-control" defaultValue={reports.filters.productServiceId ?? ""} name="productServiceId">
            <option value="">All products/services</option>
            {reports.filterOptions.productServices.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Stage
          <select className="crm-control" defaultValue={reports.filters.stageId ?? ""} name="stageId">
            <option value="">All stages</option>
            {reports.filterOptions.stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Status
          <select className="crm-control" defaultValue={reports.filters.status ?? ""} name="status">
            <option value="">All statuses</option>
            {reports.filterOptions.statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Currency
          <select className="crm-control" defaultValue={currency} name="currency">
            {reports.filterOptions.currencies.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2 md:col-span-4">
          <button className="crm-button crm-button-primary" type="submit">
            Apply filters
          </button>
          <Link className="crm-button" href="/reports">
            Reset
          </Link>
        </div>
      </form>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {reports.dashboardMetrics.map((metric) => (
          <article className="surface p-4" key={metric.label}>
            <p className="text-sm text-[var(--muted)]">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{metric.detail}</p>
          </article>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Sales reports">
          <MetricGrid
            currency={currency}
            metrics={[
              { detail: "Probability-adjusted open pipeline", label: "Weighted pipeline", money: true, value: reports.sales.weightedPipelinePaisa },
              { detail: "Won opportunities", label: "Wins", value: formatNumber(reports.sales.winLoss.won) },
              { detail: "Lost opportunities", label: "Losses", value: formatNumber(reports.sales.winLoss.lost) },
              {
                detail: "Accepted proposals over all proposals",
                label: "Proposal conversion",
                value: `${reports.sales.proposalConversion.accepted}/${reports.sales.proposalConversion.total}`
              },
              { detail: "Open follow-ups past due", label: "Overdue follow-ups", value: formatNumber(reports.sales.followUpCompliance.overdue) },
              { detail: "Open follow-ups still ahead", label: "Upcoming follow-ups", value: formatNumber(reports.sales.followUpCompliance.upcoming) }
            ]}
          />
          <h3 className="border-t border-[var(--border)] px-4 py-3 text-sm font-semibold">Open pipeline by stage</h3>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Opportunities</th>
                <th className="px-4 py-3">Pipeline value</th>
              </tr>
            </thead>
            <tbody>
              {reports.sales.pipelineFunnel.map((stage) => (
                <tr className="border-t border-[var(--border)]" key={stage.stageId}>
                  <td className="px-4 py-3">
                    <ReportLink href={`/opportunities?stageId=${stage.stageId}`}>{stage.stageName}</ReportLink>
                  </td>
                  <td className="px-4 py-3">{stage.count}</td>
                  <td className="px-4 py-3"><Money currency={currency} value={stage.valuePaisa} /></td>
                </tr>
              ))}
              {reports.sales.pipelineFunnel.length === 0 ? <EmptyRow colSpan={3} label="No open pipeline data yet." /> : null}
            </tbody>
          </table>
        </Section>

        <Section title="Finance reports">
          <MetricGrid
            currency={currency}
            metrics={[
              { detail: "Revenue minus approved costs", label: "Gross margin", money: true, value: reports.finance.grossMargin.grossMarginPaisa },
              { detail: "Approved cost components", label: "Approved cost", money: true, value: reports.finance.grossMargin.approvedCostPaisa },
              { detail: "Unapproved non-void costs", label: "Cost leakage", money: true, value: reports.finance.costLeakagePaisa },
              { detail: "Ready or approved incentive value", label: "Incentives payable", money: true, value: reports.finance.incentives.payablePaisa },
              { detail: "Approved incentive value", label: "Incentives approved", money: true, value: reports.finance.incentives.approvedPaisa },
              { detail: "Paid incentive value", label: "Incentives paid", money: true, value: reports.finance.incentives.paidPaisa }
            ]}
          />
          <h3 className="border-t border-[var(--border)] px-4 py-3 text-sm font-semibold">Collections</h3>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Receivables age</th>
                <th className="px-4 py-3">Invoices</th>
                <th className="px-4 py-3">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {reports.finance.receivablesAging.map((bucket) => (
                <tr className="border-t border-[var(--border)]" key={bucket.bucket}>
                  <td className="px-4 py-3 font-medium">{bucket.bucket}</td>
                  <td className="px-4 py-3">{bucket.invoiceCount ?? 0}</td>
                  <td className="px-4 py-3"><Money currency={currency} value={bucket.outstandingPaisa ?? 0} /></td>
                </tr>
              ))}
              {reports.finance.receivablesAging.length === 0 ? <EmptyRow colSpan={3} label="No open receivables." /> : null}
            </tbody>
          </table>
          <h3 className="border-t border-[var(--border)] px-4 py-3 text-sm font-semibold">Invoice status</h3>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Invoice status</th>
                <th className="px-4 py-3">Count</th>
                <th className="px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {reports.finance.invoiceStatus.map((status) => (
                <tr className="border-t border-[var(--border)]" key={status.status}>
                  <td className="px-4 py-3 font-medium">{status.status}</td>
                  <td className="px-4 py-3">{status.count}</td>
                  <td className="px-4 py-3"><Money currency={currency} value={status.totalPaisa ?? 0} /></td>
                </tr>
              ))}
              {reports.finance.invoiceStatus.length === 0 ? <EmptyRow colSpan={3} label="No invoices yet." /> : null}
            </tbody>
          </table>
        </Section>

        <Section title="Production reports">
          <MetricGrid
            currency={currency}
            metrics={[
              { detail: "Pending work past due date", label: "Overdue production", value: formatNumber(reports.production.overdueCount) },
              { detail: "Blocked work or stages", label: "Blocked items", value: formatNumber(reports.production.blockedCount) },
              { detail: "Longest active stage age", label: "Cycle time days", value: formatNumber(reports.production.cycleTimeDays) }
            ]}
          />
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Pending</th>
              </tr>
            </thead>
            <tbody>
              {reports.production.pendingByStage.map((stage) => (
                <tr className="border-t border-[var(--border)]" key={stage.stageName}>
                  <td className="px-4 py-3 font-medium">{stage.stageName}</td>
                  <td className="px-4 py-3">{stage.count}</td>
                </tr>
              ))}
              {reports.production.pendingByStage.length === 0 ? <EmptyRow colSpan={2} label="No pending production stages." /> : null}
            </tbody>
          </table>
        </Section>

        <Section title="Top clients">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Booked excl. GST</th>
              </tr>
            </thead>
            <tbody>
              {reports.customers.topCustomers.map((client) => (
                <tr className="border-t border-[var(--border)]" key={client.clientId}>
                  <td className="px-4 py-3">
                    <ReportLink href={`/customer-360/${client.clientId}`}>{client.clientName}</ReportLink>
                  </td>
                  <td className="px-4 py-3">{client.orderCount}</td>
                  <td className="px-4 py-3"><Money currency={currency} value={client.bookedValuePaisa} /></td>
                </tr>
              ))}
              {reports.customers.topCustomers.length === 0 ? <EmptyRow colSpan={3} label="No customer revenue data yet." /> : null}
            </tbody>
          </table>
          <h3 className="border-t border-[var(--border)] px-4 py-3 text-sm font-semibold">Top products/services</h3>
          <table className="min-w-full border-t border-[var(--border)] text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Product/service</th>
                <th className="px-4 py-3">Revenue</th>
                <th className="px-4 py-3">Margin</th>
              </tr>
            </thead>
            <tbody>
              {reports.products.revenueAndMargin.map((product) => (
                <tr className="border-t border-[var(--border)]" key={product.productName}>
                  <td className="px-4 py-3 font-medium">{product.productName}</td>
                  <td className="px-4 py-3"><Money currency={currency} value={product.revenuePaisa} /></td>
                  <td className="px-4 py-3"><Money currency={currency} value={product.grossMarginPaisa} /></td>
                </tr>
              ))}
              {reports.products.revenueAndMargin.length === 0 ? <EmptyRow colSpan={3} label="No product revenue data yet." /> : null}
            </tbody>
          </table>
        </Section>

        <Section title="Recent booked orders">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Booked excl. GST</th>
              </tr>
            </thead>
            <tbody>
              {reports.recentOrders.map((order) => (
                <tr className="border-t border-[var(--border)]" key={order.orderId}>
                  <td className="px-4 py-3"><ReportLink href={`/orders/${order.orderId}`}>{order.orderNumber}</ReportLink></td>
                  <td className="px-4 py-3"><ReportLink href={`/customer-360/${order.clientId}`}>{order.clientName}</ReportLink></td>
                  <td className="px-4 py-3">{order.status}</td>
                  <td className="px-4 py-3"><Money currency={currency} value={order.bookedValuePaisa} /></td>
                </tr>
              ))}
              {reports.recentOrders.length === 0 ? <EmptyRow colSpan={4} label="No recent booked orders yet." /> : null}
            </tbody>
          </table>
        </Section>

        <Section title="Top billings">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Booked excl. GST</th>
              </tr>
            </thead>
            <tbody>
              {reports.topBillings.map((billing) => (
                <tr className="border-t border-[var(--border)]" key={billing.orderId}>
                  <td className="px-4 py-3"><ReportLink href={`/orders/${billing.orderId}`}>{billing.orderNumber}</ReportLink></td>
                  <td className="px-4 py-3"><ReportLink href={`/customer-360/${billing.clientId}`}>{billing.clientName}</ReportLink></td>
                  <td className="px-4 py-3">{billing.ownerName}</td>
                  <td className="px-4 py-3"><Money currency={currency} value={billing.bookedValuePaisa} /></td>
                </tr>
              ))}
              {reports.topBillings.length === 0 ? <EmptyRow colSpan={4} label="No booked orders yet." /> : null}
            </tbody>
          </table>
        </Section>

        <Section title="Production pending">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Due</th>
              </tr>
            </thead>
            <tbody>
              {reports.pendingProduction.map((workItem) => (
                <tr className="border-t border-[var(--border)]" key={workItem.workItemId}>
                  <td className="px-4 py-3"><ReportLink href={`/production/${workItem.workItemId}`}>{workItem.orderNumber}</ReportLink></td>
                  <td className="px-4 py-3">{workItem.clientName}</td>
                  <td className="px-4 py-3">{workItem.productName}</td>
                  <td className="px-4 py-3">{formatDate(workItem.dueAt)}</td>
                </tr>
              ))}
              {reports.pendingProduction.length === 0 ? <EmptyRow colSpan={4} label="No pending production work." /> : null}
            </tbody>
          </table>
        </Section>

        <Section title="Upcoming follow-ups">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Due</th>
              </tr>
            </thead>
            <tbody>
              {reports.upcomingFollowUps.map((followUp) => (
                <tr className="border-t border-[var(--border)]" key={followUp.activityId}>
                  <td className="px-4 py-3 font-medium">{followUp.subject}</td>
                  <td className="px-4 py-3">{followUp.clientName}</td>
                  <td className="px-4 py-3">{followUp.ownerName}</td>
                  <td className="px-4 py-3">{formatDate(followUp.dueAt)}</td>
                </tr>
              ))}
              {reports.upcomingFollowUps.length === 0 ? <EmptyRow colSpan={4} label="No upcoming follow-ups." /> : null}
            </tbody>
          </table>
        </Section>
      </div>
    </div>
  );
}
