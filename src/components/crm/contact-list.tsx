import Link from "next/link";
import { EmptyState, MetricStrip, PageHeader, RoleBadge, StatusBadge } from "@/components/ui/sales-primitives";

type ContactListProps = {
  filters: {
    q?: string;
    ownerId?: string;
    state?: "LEAD" | "CUSTOMER" | "DORMANT";
  };
  owners: Array<{ id: string; name: string; email: string; role: "ADMIN" | "SALES" }>;
  records: Array<{
    id: string;
    name: string;
    designation: string | null;
    email: string | null;
    phone: string | null;
    isPrimary: boolean;
    updatedAt: Date;
    branch: { id: string; name: string; city: string | null; region: string | null } | null;
    leadCustomer: {
      id: string;
      name: string;
      state: "LEAD" | "CUSTOMER" | "DORMANT";
      owner: { id: string; name: string; email: string; role: "ADMIN" | "SALES" };
      _count: { contacts: number; opportunities: number };
    };
  }>;
};

function formatDate(date: Date | null) {
  if (!date) {
    return "Not set";
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

function countLabel(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function getContactMetrics(records: ContactListProps["records"]) {
  return [
    { label: "Visible contacts", value: records.length.toString(), detail: "After current filters" },
    { label: "Primary contacts", value: records.filter((record) => record.isPrimary).length.toString(), detail: "Marked on the lead" },
    {
      label: "With pipeline",
      value: records.filter((record) => record.leadCustomer._count.opportunities > 0).length.toString(),
      detail: "Contacts tied to active opportunities"
    },
    {
      label: "Communication details",
      value: records.reduce((total, record) => total + Number(Boolean(record.email) || Boolean(record.phone)), 0).toString(),
      detail: "Contacts with email or phone"
    }
  ];
}

export function ContactList({ filters, owners, records }: ContactListProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Link className="crm-button crm-button-secondary text-sm" href="/leads">
              Open leads
            </Link>
            <Link className="crm-button crm-button-primary text-sm" href="/leads/new">
              Add lead/customer
            </Link>
          </>
        }
        eyebrow="Contact registry"
        title="Contacts"
        description="Browse contacts across all leads and customers without mixing them into the lead list."
      />

      <MetricStrip metrics={getContactMetrics(records)} />

      <form action="/contacts" className="surface grid gap-4 p-4 md:grid-cols-4" method="get">
        <label className="flex flex-col gap-1 text-sm font-medium md:col-span-2">
          Search
          <input
            className="crm-control"
            defaultValue={filters.q ?? ""}
            name="q"
            placeholder="Contact, designation, lead, branch"
            type="search"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Lead owner
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
          Lead state
          <select className="crm-control" defaultValue={filters.state ?? ""} name="state">
            <option value="">All lead states</option>
            <option value="LEAD">LEAD</option>
            <option value="CUSTOMER">CUSTOMER</option>
            <option value="DORMANT">DORMANT</option>
          </select>
        </label>

        <div className="md:col-span-4">
          <button className="crm-button crm-button-secondary text-sm" type="submit">
            Apply filters
          </button>
        </div>
      </form>

      {records.length === 0 ? (
        <EmptyState
          actions={
            <Link className="crm-button crm-button-primary text-sm" href="/leads/new">
              Add lead/customer
            </Link>
          }
          title="No matching contacts"
          description="Change filters or add contacts through a lead/customer record."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Lead/customer</th>
                <th className="px-4 py-3 font-semibold">Owner</th>
                <th className="px-4 py-3 font-semibold">Pipeline</th>
                <th className="px-4 py-3 font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr className="border-t border-[var(--border)]" key={record.id}>
                  <td className="px-4 py-4 align-top">
                    <Link className="font-semibold text-[var(--accent-strong)] hover:underline" href={`/contacts/${record.id}`}>
                      {record.name}
                    </Link>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                      <StatusBadge tone={record.isPrimary ? "success" : "neutral"}>{record.isPrimary ? "Primary" : "Secondary"}</StatusBadge>
                      {record.designation ? <span>{record.designation}</span> : null}
                    </div>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      {record.email ?? "No email"}
                      {record.phone ? ` - ${record.phone}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <Link className="font-semibold text-[var(--accent-strong)] hover:underline" href={`/leads/${record.leadCustomer.id}`}>
                      {record.leadCustomer.name}
                    </Link>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                      <StatusBadge tone={stateTone(record.leadCustomer.state)}>{record.leadCustomer.state}</StatusBadge>
                      {record.branch ? <span>{record.branch.name}</span> : <span>Company level</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{record.leadCustomer.owner.name}</p>
                      <RoleBadge role={record.leadCustomer.owner.role} />
                    </div>
                    <p className="text-xs text-[var(--muted)]">{record.leadCustomer.owner.email}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-[var(--muted)]">
                    <p>{countLabel(record.leadCustomer._count.contacts, "contact")}</p>
                    <p>{countLabel(record.leadCustomer._count.opportunities, "opportunity")}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-[var(--muted)]">{formatDate(record.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
