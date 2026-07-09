import Link from "next/link";
import type { IncentiveListFilters, IncentiveListRecord } from "@/server/finance/incentives-queries";
import { formatCurrencyPaisa } from "@/components/reports/report-formatters";

type IncentiveListProps = {
  filters: IncentiveListFilters;
  incentives: IncentiveListRecord[];
  owners?: Array<{ email: string; id: string; name: string }>;
  title?: string;
  subtitle?: string;
};

const incentiveStatuses = ["NOT_READY", "READY_FOR_REVIEW", "APPROVED", "REJECTED", "PAID", "VOID"] as const;

function yearOptions() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, index) => currentYear - index);
}

export function IncentiveList({
  filters,
  incentives,
  owners = [],
  title = "Incentives",
  subtitle = "Rep-ready incentive records with payout and approval context."
}: IncentiveListProps) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
      </header>

      <form action="/incentives" className="surface grid gap-4 p-4 md:grid-cols-5" method="get">
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
            <option value="">Full year</option>
            <option value="1">Q1 Jan-Mar</option>
            <option value="2">Q2 Apr-Jun</option>
            <option value="3">Q3 Jul-Sep</option>
            <option value="4">Q4 Oct-Dec</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Owner
          <select className="crm-control" defaultValue={filters.ownerId ?? ""} name="ownerId">
            <option value="">All owners</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name} ({owner.email})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Status
          <select className="crm-control" defaultValue={filters.status ?? ""} name="status">
            <option value="">All statuses</option>
            {incentiveStatuses.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <button className="crm-button crm-button-primary text-sm" type="submit">
            Apply filters
          </button>
          <Link className="crm-button crm-button-secondary text-sm" href="/incentives">
            Reset
          </Link>
        </div>
      </form>

      {incentives.length === 0 ? <p className="surface p-4 text-sm text-[var(--muted)]">No incentives found for this view.</p> : null}
      <div className="space-y-3">
        {incentives.map((incentive) => (
          <article className="surface p-4" key={incentive.id}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold text-slate-950">{incentive.order.orderNumber}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {incentive.order.leadCustomer.name} - {incentive.order.owner.name} - {incentive.status}
                </p>
              </div>
              <p className="font-semibold">{formatCurrencyPaisa(incentive.payableAmountPaisa, incentive.order.currency as "INR" | "USD")}</p>
            </div>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs uppercase text-[var(--muted)]">Readiness</p>
                <p className="font-medium">{incentive.readinessReason ?? "Ready for review"}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-[var(--muted)]">Calculated</p>
                <p className="font-medium">{formatCurrencyPaisa(incentive.calculatedAmountPaisa, incentive.order.currency as "INR" | "USD")}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-[var(--muted)]">Approved</p>
                <p className="font-medium">{incentive.approvedAt ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(incentive.approvedAt) : "Not approved"}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-[var(--muted)]">Paid</p>
                <p className="font-medium">{incentive.paidAt ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(incentive.paidAt) : "Not paid"}</p>
              </div>
            </div>
            {incentive.splits.length ? (
              <div className="mt-3 text-sm text-[var(--muted)]">
                {incentive.splits.map((split) => (
                  <p key={split.userId}>
                    {split.user.name}: {split.percent}% - {formatCurrencyPaisa(split.amountPaisa, incentive.order.currency as "INR" | "USD")}
                  </p>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
