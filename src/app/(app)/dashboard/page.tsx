import Link from "next/link";
import { requireUser } from "@/server/auth/current-user";
import { formatInrPaisa } from "@/components/reports/report-formatters";
import { getReportsOverview } from "@/server/reports/queries";

function metricByLabel(
  metrics: Array<{ detail: string; label: string; value: string }>,
  label: string
) {
  const metric = metrics.find((entry) => entry.label === label);
  if (!metric) {
    throw new Error(`Dashboard metric not found: ${label}`);
  }
  return metric;
}

function MetricCard({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <article className="dashboard-metric-card">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{detail}</p>
    </article>
  );
}

export default async function DashboardPage() {
  const user = await requireUser("crm");
  const reports = await getReportsOverview(user);
  const openOpportunities = metricByLabel(reports.dashboardMetrics, "Open opportunities");
  const pipelineValue = metricByLabel(reports.dashboardMetrics, "Pipeline value");
  const bookedValue = metricByLabel(reports.dashboardMetrics, "Booked value");
  const pendingReceivables = metricByLabel(reports.dashboardMetrics, "Pending receivables");
  const collectedPayments = metricByLabel(reports.dashboardMetrics, "Collected payments");
  const productionPending = metricByLabel(reports.dashboardMetrics, "Production pending");
  const upcomingFollowUps = metricByLabel(reports.dashboardMetrics, "Upcoming follow-ups");

  return (
    <div className="dashboard-shell">
      <section className="dashboard-lead dashboard-lead-simple">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Company-wide sales, billing, collection, production, and follow-up metrics from live CRM records.
        </p>
      </section>

      <section className="dashboard-grid dashboard-grid-stacked">
        <section aria-label="Sales overview" className="dashboard-section">
          <div className="dashboard-section-header">
            <div>
              <p className="dashboard-section-kicker">Sales</p>
              <h2 className="text-lg font-semibold">Sales</h2>
              <p className="text-sm text-[var(--muted)]">Customer follow-ups and booked-account momentum.</p>
            </div>
            <a className="dashboard-link" href="/reports">
              View reports
            </a>
          </div>
          <div className="dashboard-section-panel">
            <div className="dashboard-metric-grid sm:grid-cols-2">
              <MetricCard {...upcomingFollowUps} />
            </div>
          </div>
          <div className="dashboard-section-panel surface overflow-hidden">
            <table className="dashboard-table min-w-full text-left text-sm">
              <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Orders</th>
                  <th className="px-4 py-3">Booked value</th>
                </tr>
              </thead>
              <tbody>
                {reports.topClients.slice(0, 3).map((client) => (
                  <tr className="border-t border-[var(--border)]" key={client.clientId}>
                    <td className="px-4 py-3 font-medium">{client.clientName}</td>
                    <td className="px-4 py-3">{client.orderCount}</td>
                    <td className="px-4 py-3">{formatInrPaisa(client.bookedValuePaisa)}</td>
                  </tr>
                ))}
                {reports.topClients.length === 0 ? (
                  <tr>
                    <td className="px-4 py-3 text-[var(--muted)]" colSpan={3}>
                      No client billing data yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-label="Pipeline overview" className="dashboard-section">
          <div className="dashboard-section-header">
            <div>
              <p className="dashboard-section-kicker">Pipeline</p>
              <h2 className="text-lg font-semibold">Pipeline</h2>
              <p className="text-sm text-[var(--muted)]">Open opportunities and stage-wise value in motion.</p>
            </div>
            <Link className="dashboard-link" href="/opportunities">
              View pipeline
            </Link>
          </div>
          <div className="dashboard-section-panel">
            <div className="dashboard-metric-grid sm:grid-cols-2">
              <MetricCard {...openOpportunities} />
              <MetricCard {...pipelineValue} />
            </div>
          </div>
          <div className="dashboard-section-panel surface overflow-hidden">
            <table className="dashboard-table min-w-full text-left text-sm">
              <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Open</th>
                  <th className="px-4 py-3">Value</th>
                </tr>
              </thead>
              <tbody>
                {reports.pipelineByStage.slice(0, 4).map((stage) => (
                  <tr className="border-t border-[var(--border)]" key={stage.stageId}>
                    <td className="px-4 py-3 font-medium">{stage.stageName}</td>
                    <td className="px-4 py-3">{stage.count}</td>
                    <td className="px-4 py-3">{formatInrPaisa(stage.valuePaisa)}</td>
                  </tr>
                ))}
                {reports.pipelineByStage.length === 0 ? (
                  <tr>
                    <td className="px-4 py-3 text-[var(--muted)]" colSpan={3}>
                      No open pipeline yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-label="Orders overview" className="dashboard-section">
          <div className="dashboard-section-header">
            <div>
              <p className="dashboard-section-kicker">Orders</p>
              <h2 className="text-lg font-semibold">Orders</h2>
              <p className="text-sm text-[var(--muted)]">Booked revenue, collections, and receivables in one place.</p>
            </div>
            <a className="dashboard-link" href="/reports">
              View reports
            </a>
          </div>
          <div className="dashboard-section-panel">
            <div className="dashboard-metric-grid sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard {...bookedValue} />
              <MetricCard {...pendingReceivables} />
              <MetricCard {...collectedPayments} />
            </div>
          </div>
          <div className="dashboard-section-panel surface overflow-hidden">
            <table className="dashboard-table min-w-full text-left text-sm">
              <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Booked value</th>
                </tr>
              </thead>
              <tbody>
                {reports.topBillings.slice(0, 3).map((billing) => (
                  <tr className="border-t border-[var(--border)]" key={billing.orderId}>
                    <td className="px-4 py-3 font-medium">{billing.orderNumber}</td>
                    <td className="px-4 py-3">{billing.clientName}</td>
                    <td className="px-4 py-3">{formatInrPaisa(billing.bookedValuePaisa)}</td>
                  </tr>
                ))}
                {reports.topBillings.length === 0 ? (
                  <tr>
                    <td className="px-4 py-3 text-[var(--muted)]" colSpan={3}>
                      No booked orders yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-label="Production overview" className="dashboard-section">
          <div className="dashboard-section-header">
            <div>
              <p className="dashboard-section-kicker">Production</p>
              <h2 className="text-lg font-semibold">Production</h2>
              <p className="text-sm text-[var(--muted)]">Pending work items that still need delivery attention.</p>
            </div>
            <a className="dashboard-link" href="/reports">
              View reports
            </a>
          </div>
          <div className="dashboard-section-panel">
            <div className="dashboard-metric-grid sm:grid-cols-2">
              <MetricCard {...productionPending} />
            </div>
          </div>
          <div className="dashboard-section-panel surface overflow-hidden">
            <table className="dashboard-table min-w-full text-left text-sm">
              <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Work item</th>
                </tr>
              </thead>
              <tbody>
                {reports.pendingProduction.slice(0, 4).map((workItem) => (
                  <tr className="border-t border-[var(--border)]" key={workItem.workItemId}>
                    <td className="px-4 py-3 font-medium">{workItem.orderNumber}</td>
                    <td className="px-4 py-3">{workItem.clientName}</td>
                    <td className="px-4 py-3">{workItem.productName}</td>
                  </tr>
                ))}
                {reports.pendingProduction.length === 0 ? (
                  <tr>
                    <td className="px-4 py-3 text-[var(--muted)]" colSpan={3}>
                      No pending production work.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </div>
  );
}
