import { formatDate, formatInrPaisa } from "@/components/reports/report-formatters";
import { requireUser } from "@/server/auth/current-user";
import { getReportsOverview } from "@/server/reports/queries";

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td className="px-4 py-3 text-sm text-[var(--muted)]" colSpan={colSpan}>
        {label}
      </td>
    </tr>
  );
}

function Section({
  children,
  title
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="surface overflow-hidden">{children}</div>
    </section>
  );
}

export default async function ReportsPage() {
  const user = await requireUser();
  const reports = await getReportsOverview(user);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Company-wide read-only reporting for clients, billings, collections, pipeline, production, and follow-ups.
        </p>
      </section>

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
        <Section title="Top clients">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Booked excl. GST</th>
              </tr>
            </thead>
            <tbody>
              {reports.topClients.map((client) => (
                <tr className="border-t border-[var(--border)]" key={client.clientId}>
                  <td className="px-4 py-3 font-medium">{client.clientName}</td>
                  <td className="px-4 py-3">{client.orderCount}</td>
                  <td className="px-4 py-3">{formatInrPaisa(client.bookedValuePaisa)}</td>
                </tr>
              ))}
              {reports.topClients.length === 0 ? <EmptyRow colSpan={3} label="No client billing data yet." /> : null}
            </tbody>
          </table>
        </Section>

        <Section title="Top products/services">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Product/service</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Booked excl. GST</th>
              </tr>
            </thead>
            <tbody>
              {reports.topProducts.map((product) => (
                <tr className="border-t border-[var(--border)]" key={product.productName}>
                  <td className="px-4 py-3 font-medium">{product.productName}</td>
                  <td className="px-4 py-3">{product.orderCount}</td>
                  <td className="px-4 py-3">{formatInrPaisa(product.bookedValuePaisa)}</td>
                </tr>
              ))}
              {reports.topProducts.length === 0 ? <EmptyRow colSpan={3} label="No product billing data yet." /> : null}
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
                  <td className="px-4 py-3 font-medium">{billing.orderNumber}</td>
                  <td className="px-4 py-3">{billing.clientName}</td>
                  <td className="px-4 py-3">{billing.ownerName}</td>
                  <td className="px-4 py-3">{formatInrPaisa(billing.bookedValuePaisa)}</td>
                </tr>
              ))}
              {reports.topBillings.length === 0 ? <EmptyRow colSpan={4} label="No booked orders yet." /> : null}
            </tbody>
          </table>
        </Section>

        <Section title="Collections">
          <div className="grid gap-4 p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase text-[var(--muted)]">Collected</p>
              <p className="mt-1 text-xl font-semibold">{formatInrPaisa(reports.collections.collectedPaisa)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-[var(--muted)]">Pending receivables</p>
              <p className="mt-1 text-xl font-semibold">{formatInrPaisa(reports.collections.pendingReceivablePaisa)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-[var(--muted)]">Payments</p>
              <p className="mt-1 text-xl font-semibold">{reports.collections.paymentCount}</p>
            </div>
          </div>
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
                  <td className="px-4 py-3 font-medium">{order.orderNumber}</td>
                  <td className="px-4 py-3">{order.clientName}</td>
                  <td className="px-4 py-3">{order.status}</td>
                  <td className="px-4 py-3">{formatInrPaisa(order.bookedValuePaisa)}</td>
                </tr>
              ))}
              {reports.recentOrders.length === 0 ? <EmptyRow colSpan={4} label="No recent booked orders yet." /> : null}
            </tbody>
          </table>
        </Section>

        <Section title="Open pipeline by stage">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Opportunities</th>
                <th className="px-4 py-3">Pipeline value</th>
              </tr>
            </thead>
            <tbody>
              {reports.pipelineByStage.map((stage) => (
                <tr className="border-t border-[var(--border)]" key={stage.stageId}>
                  <td className="px-4 py-3 font-medium">{stage.stageName}</td>
                  <td className="px-4 py-3">{stage.count}</td>
                  <td className="px-4 py-3">{formatInrPaisa(stage.valuePaisa)}</td>
                </tr>
              ))}
              {reports.pipelineByStage.length === 0 ? <EmptyRow colSpan={3} label="No open pipeline data yet." /> : null}
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
                  <td className="px-4 py-3 font-medium">{workItem.orderNumber}</td>
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
