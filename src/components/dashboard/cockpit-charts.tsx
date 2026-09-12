import { formatCurrencyPaisa, type ReportCurrency } from "@/components/reports/report-formatters";
import type { AgingBucketSummary, CockpitReports, DeliveryRiskSummary, PipelineStageSummary } from "@/server/reports/types";

type ChartPoint = { x: number; y: number };

function chartPoints(values: number[], maximum: number, width = 360, height = 160): ChartPoint[] {
  const horizontalPadding = 28;
  const verticalPadding = 24;
  const drawableWidth = width - horizontalPadding * 2;
  const drawableHeight = height - verticalPadding * 2;

  return values.map((value, index) => ({
    x: values.length === 1 ? width / 2 : horizontalPadding + (drawableWidth * index) / (values.length - 1),
    y: height - verticalPadding - (value / maximum) * drawableHeight
  }));
}

function svgPoints(points: ChartPoint[]) {
  return points.map(({ x, y }) => `${x},${y}`).join(" ");
}

function hasValue(value: number | undefined): value is number {
  return typeof value === "number" && value > 0;
}

export function BookedCollectedTrend({ currency, trend }: { currency: ReportCurrency; trend: CockpitReports["trend"] }): React.JSX.Element {
  const months = trend.months;
  const bookedTotal = months.reduce((total, month) => total + month.bookedPaisa, 0);
  const collectedTotal = months.reduce((total, month) => total + month.collectedPaisa, 0);
  const maximum = Math.max(...months.flatMap((month) => [month.bookedPaisa, month.collectedPaisa]), 1);
  const hasChartData = trend.hasHistory && months.some((month) => month.bookedPaisa > 0 || month.collectedPaisa > 0);
  const bookedPoints = chartPoints(months.map((month) => month.bookedPaisa), maximum);
  const collectedPoints = chartPoints(months.map((month) => month.collectedPaisa), maximum);

  return (
    <figure aria-label="Booked vs collected trend" className="surface p-4">
      <figcaption>
        <h3 className="font-semibold text-slate-950">Booked vs collected</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">Bookings and payments across the last six months.</p>
      </figcaption>
      {hasChartData ? (
        <>
          <svg aria-label="Booked vs collected trend" className="mt-4 h-auto w-full" role="img" viewBox="0 0 360 160">
            <line stroke="var(--border)" strokeWidth="1" x1="28" x2="332" y1="136" y2="136" />
            <polyline fill="none" points={svgPoints(bookedPoints)} stroke="var(--brand-navy)" strokeWidth="3" />
            <polyline fill="none" points={svgPoints(collectedPoints)} stroke="var(--accent)" strokeDasharray="8 5" strokeWidth="3" />
            {collectedPoints.map((point, index) => (
              <circle cx={point.x} cy={point.y} fill="var(--accent)" key={months[index].label} r="3.5" />
            ))}
            {months.map((month, index) => {
              const point = bookedPoints[index];
              return (
                <text fill="currentColor" fontSize="11" key={month.label} textAnchor="middle" x={point.x} y="156">
                  {month.label}
                </text>
              );
            })}
          </svg>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Booked {formatCurrencyPaisa(bookedTotal, currency)}; collected {formatCurrencyPaisa(collectedTotal, currency)}.
          </p>
          <ul aria-label="Chart legend" className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--muted)]">
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="h-0 w-5 border-t-[3px] border-[var(--brand-navy)]" />
              Booked
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="h-0 w-5 border-t-[3px] border-dashed border-[var(--accent)]" />
              Collected (dashed with markers)
            </li>
          </ul>
          <ul aria-label="Booked and collected detail" className="sr-only">
            {months.map((month) => (
              <li key={month.label}>
                {month.label}: booked {formatCurrencyPaisa(month.bookedPaisa, currency)}; collected {formatCurrencyPaisa(month.collectedPaisa, currency)}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-4 rounded-md border border-dashed border-[var(--border)] px-3 py-6 text-sm text-[var(--muted)]">Not enough history yet</p>
      )}
    </figure>
  );
}

export function PipelineStageBars({ currency, stages }: { currency: ReportCurrency; stages: PipelineStageSummary[] }): React.JSX.Element {
  const maximum = Math.max(...stages.map((stage) => stage.valuePaisa), 1);

  return (
    <figure aria-label="Pipeline by stage" className="surface p-4">
      <figcaption>
        <h3 className="font-semibold text-slate-950">Pipeline by stage</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">Open opportunity value by current stage.</p>
      </figcaption>
      {stages.length > 0 ? (
        <svg aria-label="Pipeline by stage" className="mt-4 h-auto w-full" role="img" viewBox={`0 0 360 ${Math.max(76, stages.length * 48)}`}>
          {stages.map((stage, index) => {
            const y = index * 48 + 8;
            const width = (stage.valuePaisa / maximum) * 190;
            return (
              <g key={stage.stageId}>
                <text fill="currentColor" fontSize="12" x="0" y={y + 12}>
                  {stage.stageName}
                </text>
                <rect fill="var(--accent-soft)" height="16" rx="4" width="190" x="0" y={y + 20} />
                <rect fill="var(--brand-navy)" height="16" rx="4" width={width} x="0" y={y + 20} />
                <text fill="currentColor" fontSize="12" textAnchor="end" x="350" y={y + 33}>
                  {formatCurrencyPaisa(stage.valuePaisa, currency)}
                </text>
              </g>
            );
          })}
        </svg>
      ) : (
        <p className="mt-4 text-sm text-[var(--muted)]">No open pipeline yet.</p>
      )}
      {stages.length > 0 ? (
        <ul aria-label="Pipeline stage detail" className="sr-only">
          {stages.map((stage) => (
            <li key={stage.stageId}>
              {stage.stageName}: {stage.count} opportunities, {formatCurrencyPaisa(stage.valuePaisa, currency)}
            </li>
          ))}
        </ul>
      ) : null}
    </figure>
  );
}

export function ReceivablesAgingBars({ buckets, currency }: { buckets: AgingBucketSummary[]; currency: ReportCurrency }): React.JSX.Element {
  const maximum = Math.max(...buckets.map((bucket) => bucket.outstandingPaisa ?? 0), 1);

  return (
    <figure aria-label="Receivables aging" className="surface p-4">
      <figcaption>
        <h3 className="font-semibold text-slate-950">Receivables aging</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">Outstanding invoice value by age.</p>
      </figcaption>
      {buckets.some((bucket) => hasValue(bucket.outstandingPaisa)) ? (
        <svg aria-label="Receivables aging" className="mt-4 h-auto w-full" role="img" viewBox={`0 0 360 ${Math.max(76, buckets.length * 48)}`}>
          {buckets.map((bucket, index) => {
            const value = bucket.outstandingPaisa ?? 0;
            const y = index * 48 + 8;
            return (
              <g key={bucket.bucket}>
                <text fill="currentColor" fontSize="12" x="0" y={y + 12}>
                  {bucket.bucket}
                </text>
                <rect fill="var(--accent-soft)" height="16" rx="4" width="190" x="0" y={y + 20} />
                <rect fill="var(--accent)" height="16" rx="4" width={(value / maximum) * 190} x="0" y={y + 20} />
                <text fill="currentColor" fontSize="12" textAnchor="end" x="350" y={y + 33}>
                  {formatCurrencyPaisa(value, currency)}
                </text>
              </g>
            );
          })}
        </svg>
      ) : (
        <p className="mt-4 text-sm text-[var(--muted)]">No outstanding receivables.</p>
      )}
      <ul aria-label="Receivables aging detail" className="sr-only">
        {buckets.map((bucket) => (
          <li key={bucket.bucket}>
            {bucket.bucket}: {bucket.invoiceCount ?? 0} invoices, {formatCurrencyPaisa(bucket.outstandingPaisa ?? 0, currency)}
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function DeliveryRiskPanel({ risk }: { risk: DeliveryRiskSummary }): React.JSX.Element {
  const rows = [
    { count: risk.blockedCount, label: "Blocked" },
    { count: risk.dueSoonCount, label: "Due soon" },
    { count: risk.overdueCount, label: "Overdue" }
  ];

  return (
    <figure aria-label="Delivery risk" className="surface p-4">
      <figcaption>
        <h3 className="font-semibold text-slate-950">Delivery risk</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">{risk.totalCount} pending production items need attention.</p>
      </figcaption>
      <ul aria-label="Delivery risk detail" className="mt-4 space-y-2">
        {rows.map((row) => (
          <li className="flex items-center justify-between rounded-md border border-[var(--border)] px-3 py-2 text-sm" key={row.label}>
            <span>{row.label}</span>
            <span className="font-semibold text-slate-950">{row.count}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
