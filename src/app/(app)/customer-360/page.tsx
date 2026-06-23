import Link from "next/link";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui/sales-primitives";
import { requireUser } from "@/server/auth/current-user";
import { listLeadCustomers } from "@/server/crm/queries";
import { leadFilterSchema } from "@/server/crm/validators";

function formatDate(date: Date | null) {
  return date ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date) : "Not set";
}

export default async function Customer360LauncherPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const rawSearchParams = await searchParams;
  const filters = leadFilterSchema.parse({
    followUp: rawSearchParams.followUp,
    ownerId: rawSearchParams.ownerId,
    q: rawSearchParams.q,
    state: rawSearchParams.state
  });
  const { owners, records } = await listLeadCustomers(user, filters);

  return (
    <div className="space-y-6">
      <PageHeader
        description="Launch a single customer view with activity, notes, opportunities, orders, production, finance, and follow-up history."
        eyebrow="Customer workspace"
        title="Customer 360"
      />

      <form action="/customer-360" className="surface grid gap-4 p-4 md:grid-cols-5" method="get">
        <label className="flex flex-col gap-1 text-sm font-medium md:col-span-2">
          Search customer
          <input className="crm-control" defaultValue={filters.q ?? ""} name="q" placeholder="Customer, contact, industry, source" type="search" />
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
            <option value="">Any state</option>
            <option value="LEAD">Lead</option>
            <option value="CUSTOMER">Customer</option>
            <option value="DORMANT">Dormant</option>
          </select>
        </label>
        <div className="flex items-end">
          <button className="crm-button crm-button-primary w-full" type="submit">
            Search
          </button>
        </div>
      </form>

      {records.length === 0 ? (
        <EmptyState description="Adjust the filters or add a lead/customer before launching Customer 360." title="No customers found" />
      ) : (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {records.map((record) => {
            const nextActivity = record.activities[0];

            return (
              <article className="surface flex min-h-52 flex-col justify-between p-4" key={record.id}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="break-words text-lg font-semibold text-slate-950">{record.name}</h2>
                    <StatusBadge tone={record.state === "CUSTOMER" ? "success" : record.state === "DORMANT" ? "warning" : "info"}>{record.state}</StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted)]">Owner {record.owner.name}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs uppercase text-[var(--muted)]">Branches</p>
                      <p className="font-medium">{record._count.branches}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-[var(--muted)]">Contacts</p>
                      <p className="font-medium">{record._count.contacts}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-[var(--muted)]">
                    Next follow-up: {nextActivity ? `${nextActivity.subject} on ${formatDate(nextActivity.dueAt)}` : "No open follow-up"}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link className="crm-button crm-button-primary text-sm" href={`/customer-360/${record.id}`}>
                    Open 360
                  </Link>
                  <Link className="crm-button crm-button-secondary text-sm" href={`/leads/${record.id}`}>
                    Lead detail
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
