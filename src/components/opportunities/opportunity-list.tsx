import Link from "next/link";

type Filters = {
  q?: string;
  ownerId?: string;
  stageId?: string;
  followUp?: "overdue" | "today" | "upcoming";
  view?: "list" | "board";
};

type Owner = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "SALES";
};

type Stage = {
  id: string;
  name: string;
  sortOrder: number;
  kind: "OPEN" | "WON" | "LOST" | "DORMANT";
  active: boolean;
};

type OpportunityRow = {
  id: string;
  title: string;
  productInterest: string | null;
  estimatedValueInr: unknown;
  probability: number | null;
  nextFollowUpAt: Date | null;
  updatedAt: Date;
  leadCustomer: { name: string; state: "LEAD" | "CUSTOMER" | "DORMANT" };
  branch: { name: string } | null;
  stage: { name: string; kind: "OPEN" | "WON" | "LOST" | "DORMANT" };
  owner: Owner;
  splits: Array<{ percent: number; user: Owner }>;
};

type OpportunityListProps = {
  children?: React.ReactNode;
  filters: Filters;
  owners: Owner[];
  records: OpportunityRow[];
  stages: Stage[];
};

function formatAmount(value: unknown) {
  if (value === null || value === undefined) {
    return "Not set";
  }

  const amount = Number(value.toString());

  if (!Number.isFinite(amount)) {
    return "Not set";
  }

  return `INR ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(amount)}`;
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

function viewHref(filters: Filters, view: "list" | "board") {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries({ ...filters, view })) {
    if (value) {
      params.set(key, value);
    }
  }

  return `/opportunities?${params.toString()}`;
}

function splitLabel(splits: OpportunityRow["splits"]) {
  if (splits.length === 0) {
    return "No splits";
  }

  return splits.map((split) => `${split.user.name} ${split.percent}%`).join(", ");
}

export function OpportunityList({ children, filters, owners, records, stages }: OpportunityListProps) {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Opportunities</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Pipeline records across company leads and customers.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold" href="/opportunities/stages">
            Stages
          </Link>
          <Link className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold" href="/opportunities/targets">
            Targets
          </Link>
          <Link className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white" href="/opportunities/new">
            New opportunity
          </Link>
        </div>
      </header>

      <form action="/opportunities" className="surface grid gap-4 p-4 md:grid-cols-6" method="get">
        <input name="view" type="hidden" value={filters.view ?? "list"} />
        <label className="flex flex-col gap-1 text-sm font-medium md:col-span-2">
          Search
          <input
            className="rounded-md border border-[var(--border)] px-3 py-2"
            defaultValue={filters.q ?? ""}
            name="q"
            placeholder="Title, customer, product, notes"
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
          Stage
          <select className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue={filters.stageId ?? ""} name="stageId">
            <option value="">All stages</option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Follow-up
          <select className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue={filters.followUp ?? ""} name="followUp">
            <option value="">Any follow-up</option>
            <option value="overdue">overdue</option>
            <option value="today">today</option>
            <option value="upcoming">upcoming</option>
          </select>
        </label>

        <div className="flex flex-wrap items-end gap-2">
          <button className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-semibold" type="submit">
            Apply filters
          </button>
        </div>
      </form>

      <div className="flex gap-2 text-sm">
        <Link
          className={`rounded-md border px-3 py-2 font-semibold ${
            (filters.view ?? "list") === "list" ? "border-[var(--accent)] text-[var(--accent-strong)]" : "border-[var(--border)]"
          }`}
          href={viewHref(filters, "list")}
        >
          List
        </Link>
        <Link
          className={`rounded-md border px-3 py-2 font-semibold ${
            filters.view === "board" ? "border-[var(--accent)] text-[var(--accent-strong)]" : "border-[var(--border)]"
          }`}
          href={viewHref(filters, "board")}
        >
          Board
        </Link>
      </div>

      {children ?? (records.length === 0 ? (
        <p className="surface p-6 text-sm text-[var(--muted)]">No opportunities match these filters.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Opportunity</th>
                <th className="px-4 py-3 font-semibold">Stage</th>
                <th className="px-4 py-3 font-semibold">Owner</th>
                <th className="px-4 py-3 font-semibold">Value</th>
                <th className="px-4 py-3 font-semibold">Follow-up</th>
                <th className="px-4 py-3 font-semibold">Splits</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr className="border-t border-[var(--border)]" key={record.id}>
                  <td className="px-4 py-4 align-top">
                    <Link className="font-semibold text-[var(--accent-strong)] hover:underline" href={`/opportunities/${record.id}`}>
                      {record.title}
                    </Link>
                    <p className="mt-1 text-sm">{record.leadCustomer.name}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                      <span className="rounded bg-slate-100 px-2 py-1">{record.leadCustomer.state}</span>
                      {record.branch ? <span>{record.branch.name}</span> : null}
                      {record.productInterest ? <span>{record.productInterest}</span> : null}
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <p className="font-medium">{record.stage.name}</p>
                    <p className="text-xs text-[var(--muted)]">{record.stage.kind}</p>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <p className="font-medium">{record.owner.name}</p>
                    <p className="text-xs text-[var(--muted)]">{record.owner.email}</p>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <p className="font-medium">{formatAmount(record.estimatedValueInr)}</p>
                    <p className="text-xs text-[var(--muted)]">{record.probability !== null ? `${record.probability}%` : "No probability"}</p>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <p>{formatDate(record.nextFollowUpAt)}</p>
                    <p className="text-xs text-[var(--muted)]">Updated {formatDate(record.updatedAt)}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-[var(--muted)]">{splitLabel(record.splits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
