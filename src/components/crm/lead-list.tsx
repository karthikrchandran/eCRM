import Link from "next/link";
import { EmptyState, MetricStrip, PageHeader, RoleBadge, StatusBadge } from "@/components/ui/sales-primitives";

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

function stateTone(state: "LEAD" | "CUSTOMER" | "DORMANT") {
  if (state === "CUSTOMER") {
    return "success" as const;
  }

  if (state === "DORMANT") {
    return "warning" as const;
  }

  return "info" as const;
}

function getLeadMetrics(records: LeadListProps["records"]) {
  const customers = records.filter((record) => record.state === "CUSTOMER").length;
  const openFollowUps = records.filter((record) => record.activities.length > 0).length;

  return [
    { label: "Visible records", value: records.length.toString(), detail: "After current filters" },
    { label: "Customers", value: customers.toString(), detail: "Converted accounts" },
    { label: "Follow-ups", value: openFollowUps.toString(), detail: "Next activity scheduled" },
    {
      label: "Coverage",
      value: records.reduce((total, record) => total + record._count.contacts, 0).toString(),
      detail: "Contacts on visible records"
    }
  ];
}

export function LeadList({ filters, owners, records }: LeadListProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Link className="crm-button crm-button-secondary text-sm" href="/leads/import">
              Import leads from CSV
            </Link>
            <Link className="crm-button crm-button-primary text-sm" href="/leads/new">
              Add one lead
            </Link>
          </>
        }
        eyebrow="Lead intake"
        title="Leads and customers"
        description="Create one sales record at a time or import a qualified list from CSV."
      />

      <MetricStrip metrics={getLeadMetrics(records)} />

      <form action="/leads" className="surface grid gap-4 p-4 md:grid-cols-5" method="get">
        <label className="flex flex-col gap-1 text-sm font-medium md:col-span-2">
          Search
          <input
            className="crm-control"
            defaultValue={filters.q ?? ""}
            name="q"
            placeholder="Name, industry, source, contact"
            type="search"
          />
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
          State
          <select className="crm-control" defaultValue={filters.state ?? ""} name="state">
            <option value="">All states</option>
            <option value="LEAD">LEAD</option>
            <option value="CUSTOMER">CUSTOMER</option>
            <option value="DORMANT">DORMANT</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Follow-up
          <select className="crm-control" defaultValue={filters.followUp ?? ""} name="followUp">
            <option value="">Any follow-up</option>
            <option value="overdue">overdue</option>
            <option value="today">today</option>
            <option value="upcoming">upcoming</option>
          </select>
        </label>

        <div className="md:col-span-5">
          <button className="crm-button crm-button-secondary text-sm" type="submit">
            Apply filters
          </button>
        </div>
      </form>

      {records.length === 0 ? (
        <EmptyState
          actions={
            <Link className="crm-button crm-button-primary text-sm" href="/leads/new">
              Add one lead
            </Link>
          }
          title="No matching leads"
          description="Change filters or add a lead to keep sales intake moving."
        />
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
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                        <StatusBadge tone={stateTone(record.state)}>{record.state}</StatusBadge>
                        {record.industry ? <span>{record.industry}</span> : null}
                        {record.source ? <span>{record.source}</span> : null}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{record.owner.name}</p>
                        <RoleBadge role={record.owner.role} />
                      </div>
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
