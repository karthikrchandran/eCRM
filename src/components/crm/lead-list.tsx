import Link from "next/link";

type LeadListProps = {
  filters: {
    q?: string;
    ownerId?: string;
    state?: "LEAD" | "CUSTOMER" | "DORMANT";
    followUp?: "overdue" | "today" | "upcoming";
  };
  owners: Array<{ id: string; name: string; email: string; role: "ADMIN" | "SALES" }>;
  records: Array<{
    id: string;
    name: string;
    state: "LEAD" | "CUSTOMER" | "DORMANT";
    industry: string | null;
    source: string | null;
    updatedAt: Date;
    owner: { id: string; name: string; email: string; role: "ADMIN" | "SALES" };
    branches: Array<{ id: string; name: string }>;
    contacts: Array<{ id: string; name: string; isPrimary: boolean }>;
    activities: Array<{ id: string; subject: string; dueAt: Date | null }>;
    _count: { branches: number; contacts: number; activities: number };
  }>;
};

function countLabel(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function formatDate(date: Date | null) {
  if (!date) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

export function LeadList({ filters, owners, records }: LeadListProps) {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Leads / Customers</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Company-wide CRM records for Sales and Admin.</p>
        </div>
        <Link className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white" href="/leads/new">
          New lead/customer
        </Link>
      </header>

      <form action="/leads" className="surface grid gap-4 p-4 md:grid-cols-5" method="get">
        <label className="flex flex-col gap-1 text-sm font-medium md:col-span-2">
          Search
          <input
            className="rounded-md border border-[var(--border)] px-3 py-2"
            defaultValue={filters.q ?? ""}
            name="q"
            placeholder="Name, industry, source, contact"
            type="search"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Owner
          <select className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue={filters.ownerId ?? ""} name="ownerId">
            <option value="">All owners</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name} ({owner.email})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          State
          <select className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue={filters.state ?? ""} name="state">
            <option value="">All states</option>
            <option value="LEAD">LEAD</option>
            <option value="CUSTOMER">CUSTOMER</option>
            <option value="DORMANT">DORMANT</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Follow-up
          <select
            className="rounded-md border border-[var(--border)] px-3 py-2"
            defaultValue={filters.followUp ?? ""}
            name="followUp"
          >
            <option value="">Any follow-up</option>
            <option value="overdue">overdue</option>
            <option value="today">today</option>
            <option value="upcoming">upcoming</option>
          </select>
        </label>

        <div className="md:col-span-5">
          <button className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-semibold" type="submit">
            Apply filters
          </button>
        </div>
      </form>

      {records.length === 0 ? (
        <p className="surface p-6 text-sm text-[var(--muted)]">No leads or customers match these filters.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Record</th>
                <th className="px-4 py-3 font-semibold">Owner</th>
                <th className="px-4 py-3 font-semibold">Coverage</th>
                <th className="px-4 py-3 font-semibold">Next follow-up</th>
                <th className="px-4 py-3 font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const nextActivity = record.activities[0];

                return (
                  <tr className="border-t border-[var(--border)]" key={record.id}>
                    <td className="px-4 py-4 align-top">
                      <Link className="font-semibold text-[var(--accent-strong)] hover:underline" href={`/leads/${record.id}`}>
                        {record.name}
                      </Link>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                        <span className="rounded bg-slate-100 px-2 py-1">{record.state}</span>
                        {record.industry ? <span>{record.industry}</span> : null}
                        {record.source ? <span>{record.source}</span> : null}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <p className="font-medium">{record.owner.name}</p>
                      <p className="text-xs text-[var(--muted)]">{record.owner.email}</p>
                    </td>
                    <td className="px-4 py-4 align-top text-[var(--muted)]">
                      <p>{countLabel(record._count.branches, "branch")}</p>
                      <p>{countLabel(record._count.contacts, "contact")}</p>
                      <p>{countLabel(record._count.activities, "activity")}</p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      {nextActivity ? (
                        <div>
                          <p className="font-medium">{nextActivity.subject}</p>
                          <p className="text-xs text-[var(--muted)]">{formatDate(nextActivity.dueAt)}</p>
                        </div>
                      ) : (
                        <span className="text-[var(--muted)]">None scheduled</span>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top text-[var(--muted)]">{formatDate(record.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
