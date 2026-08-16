import Link from "next/link";
import {
  BookedCollectedTrend,
  DeliveryRiskPanel,
  PipelineStageBars,
  ReceivablesAgingBars
} from "@/components/dashboard/cockpit-charts";
import { formatCurrencyPaisa, formatDate, type ReportCurrency } from "@/components/reports/report-formatters";
import { requireUser } from "@/server/auth/current-user";
import { getReportsOverview } from "@/server/reports/queries";

function metricByLabel(
  metrics: Array<{ detail: string; label: string; value: string }>,
  label: string
) {
  const metric = metrics.find((entry) => entry.label === label);
  if (!metric) throw new Error(`Dashboard metric not found: ${label}`);
  return metric;
}

function MetricCard({
  className = "",
  detail,
  href,
  label,
  linkLabel,
  trend,
  value
}: {
  className?: string;
  detail: string;
  href?: string;
  label: string;
  linkLabel?: string;
  trend?: React.ReactNode;
  value: string;
}) {
  const contents = (
    <>
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{detail}</p>
      {trend}
    </>
  );

  if (href && linkLabel) {
    return <Link aria-label={linkLabel} className={`dashboard-metric-card dashboard-metric-link ${className}`} href={href}>{contents}</Link>;
  }

  return (
    <article className={`dashboard-metric-card ${className}`}>{contents}</article>
  );
}

function HealthCardTrend({ currency, hasHistory = false, label, values = [] }: {
  currency: ReportCurrency;
  hasHistory?: boolean;
  label: string;
  values?: number[];
}) {
  if (!hasHistory || values.length < 2) {
    return <p aria-label="Not enough history yet." className="dashboard-cockpit-trend-status" role="status">Not enough history yet.</p>;
  }

  const maximum = Math.max(...values, 1);
  const width = 104;
  const height = 28;
  const points = values.map((value, index) => {
    const x = (width * index) / (values.length - 1);
    const y = height - 3 - (value / maximum) * (height - 6);
    return `${x},${y}`;
  }).join(" ");
  const latestValue = values.at(-1) ?? 0;
  const priorValue = values.at(-2) ?? 0;
  const delta = latestValue - priorValue;
  const comparison = delta === 0
    ? "No change from the prior month."
    : `${delta > 0 ? "Increased" : "Decreased"} by ${formatCurrencyPaisa(Math.abs(delta), currency)} from the prior month.`;
  const status = `Six-month ${label.toLowerCase()} trend available. ${comparison}`;

  return (
    <div className="dashboard-cockpit-health-trend">
      <svg aria-label={`${label} trend`} role="img" viewBox={`0 0 ${width} ${height}`}>
        <polyline fill="none" points={points} stroke="currentColor" strokeWidth="2" />
      </svg>
      <p aria-label={status} className="dashboard-cockpit-trend-status" role="status">{status}</p>
    </div>
  );
}

function deliveryRiskTone({ blockedCount, dueSoonCount, overdueCount }: { blockedCount: number; dueSoonCount: number; overdueCount: number }) {
  if (overdueCount > 0) return "critical";
  if (blockedCount > 0 || dueSoonCount > 0) return "warning";
  return "positive";
}

export default async function DashboardPage() {
  const user = await requireUser("crm");
  const reports = await getReportsOverview(user);
  const pipelineValue = metricByLabel(reports.dashboardMetrics, "Pipeline value");
  const bookedValue = metricByLabel(reports.dashboardMetrics, "Booked value");
  const pendingReceivables = metricByLabel(reports.dashboardMetrics, "Pending receivables");
  const collectedPayments = metricByLabel(reports.dashboardMetrics, "Collected payments");
  const bookingHref = user.role === "ADMIN" ? "/orders" : "/performance";
  const bookingLinkLabel = user.role === "ADMIN" ? "View orders" : "View performance";
  const riskTone = deliveryRiskTone(reports.cockpit.deliveryRisk);

  return (
    <div className="dashboard-shell">
      <section className="dashboard-lead dashboard-lead-simple">
        <p className="dashboard-section-kicker">Operations cockpit</p>
        <h1 className="mt-1 text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Company-wide sales, billing, collection, production, and follow-up metrics from live CRM records.
        </p>
      </section>

      <section aria-label="Operations health" className="dashboard-cockpit-section">
        <div className="dashboard-section-header">
          <div>
            <p className="dashboard-section-kicker">At a glance</p>
            <h2 className="text-lg font-semibold">Operations health</h2>
          </div>
          <Link className="dashboard-link" href="/reports">View reports</Link>
        </div>
        <div className="dashboard-cockpit-health-grid">
          <MetricCard
            {...pipelineValue}
            href="/opportunities"
            linkLabel="View pipeline health"
            trend={<HealthCardTrend currency={reports.currency} label="Pipeline" />}
          />
          <MetricCard
            {...bookedValue}
            href={bookingHref}
            linkLabel="View booking health"
            trend={<HealthCardTrend currency={reports.currency} hasHistory={reports.cockpit.trend.hasHistory} label="Booked" values={reports.cockpit.trend.months.map((month) => month.bookedPaisa)} />}
          />
          <MetricCard
            {...pendingReceivables}
            href="/finance"
            linkLabel="View receivables health"
            trend={<HealthCardTrend currency={reports.currency} label="Receivables" />}
          />
          <MetricCard
            {...collectedPayments}
            href="/finance"
            linkLabel="View collections health"
            trend={<HealthCardTrend currency={reports.currency} hasHistory={reports.cockpit.trend.hasHistory} label="Collections" values={reports.cockpit.trend.months.map((month) => month.collectedPaisa)} />}
          />
          <MetricCard
            className={`dashboard-cockpit-risk--${riskTone}`}
            detail="Blocked, overdue, or due within seven days"
            href="/production"
            label="Delivery risk"
            linkLabel="View delivery health"
            trend={<HealthCardTrend currency={reports.currency} label="Delivery risk" />}
            value={String(reports.cockpit.deliveryRisk.totalCount)}
          />
        </div>
      </section>

      <section aria-label="Commercial and cash" className="dashboard-cockpit-section">
        <div className="dashboard-section-header">
          <div>
            <p className="dashboard-section-kicker">Momentum</p>
            <h2 className="text-lg font-semibold">Commercial and cash</h2>
            <p className="text-sm text-[var(--muted)]">Pipeline, bookings, collections, and delivery exposure in one view.</p>
          </div>
          <Link className="dashboard-link" href="/opportunities">View pipeline</Link>
        </div>
        <div className="dashboard-cockpit-chart-grid">
          <PipelineStageBars currency={reports.currency} stages={reports.pipelineByStage} />
          <BookedCollectedTrend currency={reports.currency} trend={reports.cockpit.trend} />
          <div className={`dashboard-cockpit-chart-with-link dashboard-cockpit-risk--${riskTone}`}>
            <DeliveryRiskPanel risk={reports.cockpit.deliveryRisk} />
            <Link className="dashboard-link" href="/production">View delivery risk</Link>
          </div>
        </div>
      </section>

      <section aria-label="Operating detail" className="dashboard-cockpit-section">
        <div className="dashboard-section-header">
          <div>
            <p className="dashboard-section-kicker">Work queue</p>
            <h2 className="text-lg font-semibold">Operating detail</h2>
            <p className="text-sm text-[var(--muted)]">The next cash, customer, booking, and production records to review.</p>
          </div>
        </div>
        <div className="dashboard-cockpit-detail-grid">
          <div className="dashboard-cockpit-chart-with-link">
            <ReceivablesAgingBars buckets={reports.finance.receivablesAging} currency={reports.currency} />
            <Link className="dashboard-link" href="/finance">View finance</Link>
          </div>

          <section className="dashboard-cockpit-list surface" aria-labelledby="follow-ups-heading">
            <div className="dashboard-cockpit-list-header">
              <div>
                <h3 id="follow-ups-heading" className="font-semibold text-slate-950">Upcoming follow-ups</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {reports.cockpit.followUpRisk.overdueCount} overdue; {reports.cockpit.followUpRisk.upcomingCount} upcoming.
                </p>
              </div>
              <Link className="dashboard-link" href="/my-day">View My Day</Link>
            </div>
            {reports.upcomingFollowUps.length > 0 ? (
              <ul className="dashboard-cockpit-list-rows">
                {reports.upcomingFollowUps.slice(0, 4).map((followUp) => (
                  <li key={followUp.activityId}>
                    <div>
                      <p className="font-medium">{followUp.subject}</p>
                      <p className="text-sm text-[var(--muted)]">{followUp.clientName} · {followUp.ownerName}</p>
                    </div>
                    <time className="text-sm text-[var(--muted)]" dateTime={followUp.dueAt?.toISOString()}>{formatDate(followUp.dueAt)}</time>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-4 text-sm text-[var(--muted)]">No upcoming follow-ups.</p>}
          </section>

          <section className="dashboard-cockpit-list surface" aria-labelledby="bookings-heading">
            <div className="dashboard-cockpit-list-header">
              <div>
                <h3 id="bookings-heading" className="font-semibold text-slate-950">Recent bookings</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">Most recently booked orders.</p>
              </div>
              <Link className="dashboard-link" href={bookingHref}>{bookingLinkLabel}</Link>
            </div>
            {reports.recentOrders.length > 0 ? (
              <ul className="dashboard-cockpit-list-rows">
                {reports.recentOrders.slice(0, 4).map((order) => (
                  <li key={order.orderId}>
                    <div>
                      <p className="font-medium">{order.orderNumber}</p>
                      <p className="text-sm text-[var(--muted)]">{order.clientName}</p>
                    </div>
                    <span className="text-sm font-medium">{formatCurrencyPaisa(order.bookedValuePaisa, reports.currency)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-4 text-sm text-[var(--muted)]">No booked orders yet.</p>}
          </section>

          <section className="dashboard-cockpit-list surface" aria-labelledby="production-heading">
            <div className="dashboard-cockpit-list-header">
              <div>
                <h3 id="production-heading" className="font-semibold text-slate-950">Pending production</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">Work items that are not done or skipped.</p>
              </div>
              <Link className="dashboard-link" href="/production">View production</Link>
            </div>
            {reports.pendingProduction.length > 0 ? (
              <ul className="dashboard-cockpit-list-rows">
                {reports.pendingProduction.slice(0, 4).map((workItem) => (
                  <li key={workItem.workItemId}>
                    <div>
                      <p className="font-medium">{workItem.productName}</p>
                      <p className="text-sm text-[var(--muted)]">{workItem.orderNumber} · {workItem.clientName}</p>
                    </div>
                    <time className="text-sm text-[var(--muted)]" dateTime={workItem.dueAt?.toISOString()}>{formatDate(workItem.dueAt)}</time>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-4 text-sm text-[var(--muted)]">No pending production work.</p>}
          </section>
        </div>
      </section>
    </div>
  );
}
