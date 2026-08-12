import { CompanyFinanceOverview } from "@/components/finance/company-finance-overview";
import { requireUser } from "@/server/auth/current-user";
import { getReportsOverview } from "@/server/reports/queries";
import type { ReportsFilters } from "@/server/reports/types";

function getParam(searchParams: Record<string, string | string[] | undefined>, key: keyof ReportsFilters) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function FinancePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("finance");
  const rawSearchParams = await searchParams;
  const filters: ReportsFilters = {
    currency: getParam(rawSearchParams, "currency") as ReportsFilters["currency"],
    dateFrom: getParam(rawSearchParams, "dateFrom"),
    dateTo: getParam(rawSearchParams, "dateTo")
  };
  const reports = await getReportsOverview(user, undefined, filters);

  return (
    <div className="space-y-6">
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
          Currency
          <select className="crm-control" defaultValue={reports.currency} name="currency">
            {reports.filterOptions.currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button className="crm-button crm-button-primary" type="submit">Apply filters</button>
          <a className="crm-button" href="/finance">Reset</a>
        </div>
      </form>
      <CompanyFinanceOverview currency={reports.currency} finance={reports.finance} topBillings={reports.topBillings} />
    </div>
  );
}
