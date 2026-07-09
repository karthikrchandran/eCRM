import { formatCurrencyPaisa } from "@/components/reports/report-formatters";
import type { RepPerformanceFilters, RepPerformanceSummary } from "@/server/reports/rep-performance-queries";

type RepComparisonTableProps = {
  filters: RepPerformanceFilters;
  rows: RepPerformanceSummary[];
};

function yearOptions() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, index) => currentYear - index);
}

function formatPaisa(value: number) {
  return formatCurrencyPaisa(value, "INR");
}

function pctOfTarget(booked: number, target: number) {
  if (target === 0) return "-";
  return `${Math.round((booked / target) * 100)}%`;
}

export function RepComparisonTable({ filters, rows }: RepComparisonTableProps) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Team performance</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Compare bookings, collections, and incentives across all sales reps.</p>
      </header>

      <form action="/admin/performance" className="surface grid gap-4 p-4 md:grid-cols-3" method="get">
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
            <option value="">All quarters</option>
            <option value="1">Q1 Jan-Mar</option>
            <option value="2">Q2 Apr-Jun</option>
            <option value="3">Q3 Jul-Sep</option>
            <option value="4">Q4 Oct-Dec</option>
          </select>
        </label>

        <div className="flex items-end">
          <button className="crm-button crm-button-primary" type="submit">
            Apply
          </button>
        </div>
      </form>

      <div className="surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              <th className="px-4 py-3">Rep</th>
              <th className="px-4 py-3 text-right">Target</th>
              <th className="px-4 py-3 text-right">Orders</th>
              <th className="px-4 py-3 text-right">Booked</th>
              <th className="px-4 py-3 text-right">% of target</th>
              <th className="px-4 py-3 text-right">Collected</th>
              <th className="px-4 py-3 text-right">Pending</th>
              <th className="px-4 py-3 text-right">Incentive payable</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-[var(--muted)]" colSpan={8}>
                  No reps found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr className="border-b border-[var(--border)] last:border-0" key={row.rep.id}>
                  <td className="px-4 py-3 font-medium">{row.rep.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.targetPaisa > 0 ? formatPaisa(row.targetPaisa) : "-"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.orderCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.bookedPaisa > 0 ? formatPaisa(row.bookedPaisa) : "-"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{pctOfTarget(row.bookedPaisa, row.targetPaisa)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.collectedPaisa > 0 ? formatPaisa(row.collectedPaisa) : "-"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.pendingReceivablePaisa > 0 ? formatPaisa(row.pendingReceivablePaisa) : "-"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.incentivePayablePaisa > 0 ? formatPaisa(row.incentivePayablePaisa) : "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
