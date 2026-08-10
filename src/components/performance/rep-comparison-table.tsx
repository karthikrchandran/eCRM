import Link from "next/link";
import { formatCurrencyPaisa } from "@/components/reports/report-formatters";
import type { RepPerformanceFilters, RepPerformanceSummary, SalesRepOption } from "@/server/reports/rep-performance-queries";

type RepComparisonTableProps = {
  filters: RepPerformanceFilters;
  repOptions?: SalesRepOption[];
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

export function RepComparisonTable({ filters, repOptions = [], rows }: RepComparisonTableProps) {
  const selectedRep = filters.ownerId ? rows[0] : undefined;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Sales performance</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Review each sales person against their target, bookings, collections, and incentives for a selected period.</p>
      </header>

      <form action="/performance" className="surface grid gap-4 p-4 md:grid-cols-4" method="get">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Sales rep
          <select className="crm-control" defaultValue={filters.ownerId ?? ""} name="ownerId">
            <option value="">All sales reps</option>
            {repOptions.map((rep) => <option key={rep.id} value={rep.id}>{rep.name}</option>)}
          </select>
        </label>
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

      {selectedRep ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Sales rep performance summary">
          <article className="surface p-4"><p className="text-xs uppercase text-[var(--muted)]">Rep target</p><p className="mt-2 text-2xl font-semibold">{formatPaisa(selectedRep.targetPaisa)}</p><p className="mt-1 text-xs text-[var(--muted)]">Configured target</p></article>
          <article className="surface p-4"><p className="text-xs uppercase text-[var(--muted)]">Rep booked</p><p className="mt-2 text-2xl font-semibold">{formatPaisa(selectedRep.bookedPaisa)}</p><p className="mt-1 text-xs text-[var(--muted)]">Booked revenue</p></article>
          <article className="surface p-4"><p className="text-xs uppercase text-[var(--muted)]">Target attainment</p><p className="mt-2 text-2xl font-semibold">{pctOfTarget(selectedRep.bookedPaisa, selectedRep.targetPaisa)}</p><p className="mt-1 text-xs text-[var(--muted)]">Booked versus target</p></article>
          <article className="surface p-4"><p className="text-xs uppercase text-[var(--muted)]">Rep collected</p><p className="mt-2 text-2xl font-semibold">{formatPaisa(selectedRep.collectedPaisa)}</p><p className="mt-1 text-xs text-[var(--muted)]">Payments collected</p></article>
          <article className="surface p-4"><p className="text-xs uppercase text-[var(--muted)]">Rep incentive payable</p><p className="mt-2 text-2xl font-semibold">{formatPaisa(selectedRep.incentivePayablePaisa)}</p><p className="mt-1 text-xs text-[var(--muted)]">Calculated incentive liability</p></article>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{selectedRep ? `${selectedRep.rep.name} performance` : "Sales reps"}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{selectedRep ? "Target, bookings, collections, and incentive detail for the selected year and quarter." : "Select a sales rep above to open an individual performance view."}</p>
        </div>
        <Link className="crm-button crm-button-secondary text-sm" href="/opportunities/targets">Manage targets</Link>
      </div>

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
