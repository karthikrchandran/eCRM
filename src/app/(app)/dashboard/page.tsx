import { requireUser } from "@/server/auth/current-user";
import { formatInrPaisa } from "@/components/reports/report-formatters";
import { getReportsOverview } from "@/server/reports/queries";

export default async function DashboardPage() {
  const user = await requireUser();
  const reports = await getReportsOverview(user);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Signed in as {user.name}. Live company-wide sales, billing, collection, production, and follow-up metrics.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.dashboardMetrics.map((metric) => (
          <article className="surface p-4" key={metric.label}>
            <p className="text-sm text-[var(--muted)]">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{metric.detail}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Top billings</h2>
            <a className="text-sm font-medium text-[var(--accent)]" href="/reports">
              View reports
            </a>
          </div>
          <div className="surface overflow-hidden">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Booked excl. GST</th>
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
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold">Top clients</h2>
          <div className="surface overflow-hidden">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Orders</th>
                  <th className="px-4 py-3">Booked excl. GST</th>
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
        </div>
      </section>
    </div>
  );
}
