import Link from "next/link";
import { MetricStrip, PageHeader, StatusBadge } from "@/components/ui/sales-primitives";

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
  leadCustomer: { id: string; name: string; state: "LEAD" | "CUSTOMER" | "DORMANT" };
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
  const amount = amountNumber(value);

  if (amount === null) {
    return "Not set";
  }

  return `INR ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(amount)}`;
}

function amountNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const amount = Number(value.toString());

  if (!Number.isFinite(amount)) {
    return null;
  }

  return amount;
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

function ownerHref(filters: Filters, ownerId?: string) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries({ ...filters, ownerId })) {
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

function followUpLabel(date: Date | null) {
  if (!date) {
    return { label: "No follow-up", tone: "neutral" as const };
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  if (date < startOfToday) {
    return { label: "Overdue", tone: "danger" as const };
  }

  if (date < startOfTomorrow) {
    return { label: "Due today", tone: "warning" as const };
  }

  return { label: "Follow-up due", tone: "info" as const };
}

export function OpportunityList({ children, filters, owners, records, stages }: OpportunityListProps) {
  const openRecords = records.filter((record) => record.stage.kind === "OPEN");
  const pipelineValue = openRecords.reduce((total, record) => total + (amountNumber(record.estimatedValueInr) ?? 0), 0);
  const weightedValue = openRecords.reduce(
    (total, record) => total + (amountNumber(record.estimatedValueInr) ?? 0) * ((record.probability ?? 0) / 100),
    0
  );
  const scheduledFollowUps = records.filter((record) => record.nextFollowUpAt).length;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
          <Link className="crm-button crm-button-secondary text-sm" href="/opportunities/stages">
            Stages
          </Link>
          <Link className="crm-button crm-button-secondary text-sm" href="/opportunities/targets">
            Targets
          </Link>
          <Link className="crm-button crm-button-primary text-sm" href="/opportunities/new">
            New opportunity
          </Link>
          </>
        }
        description="Prioritized pipeline records with next follow-ups, owner context, customer access, and value health."
        eyebrow="Sales pipeline"
        title="Pipeline"
      />

      <MetricStrip
        metrics={[
          { label: "Open pipeline", value: formatAmount(pipelineValue), detail: `${openRecords.length} active opportunities` },
          { label: "Weighted pipeline", value: formatAmount(weightedValue), detail: "Value adjusted by probability" },
          { label: "Follow-ups scheduled", value: scheduledFollowUps.toString(), detail: "Records with a next action date" },
          { label: "Visible records", value: records.length.toString(), detail: "After current filters" }
        ]}
      />

      <section className="surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Rep drilldown</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Start with the full company pipeline, then narrow to one sales rep.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                filters.ownerId ? "border-[var(--border)] text-[var(--brand-navy)]" : "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--brand-navy)]"
              }`}
              href={ownerHref(filters)}
            >
              All reps
            </Link>
            {owners.map((owner) => (
              <Link
                className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                  filters.ownerId === owner.id
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--brand-navy)]"
                    : "border-[var(--border)] text-[var(--brand-navy)]"
                }`}
                href={ownerHref(filters, owner.id)}
                key={owner.id}
              >
                {owner.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <form action="/opportunities" className="surface grid gap-4 p-4 md:grid-cols-6" method="get">
        <input name="view" type="hidden" value={filters.view ?? "list"} />
        <label className="flex flex-col gap-1 text-sm font-medium md:col-span-2">
          Search
          <input
            className="crm-control"
            defaultValue={filters.q ?? ""}
            name="q"
            placeholder="Title, customer, product, notes"
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
          Stage
          <select className="crm-control" defaultValue={filters.stageId ?? ""} name="stageId">
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
          <select className="crm-control" defaultValue={filters.followUp ?? ""} name="followUp">
            <option value="">Any follow-up</option>
            <option value="overdue">overdue</option>
            <option value="today">today</option>
            <option value="upcoming">upcoming</option>
          </select>
        </label>

        <div className="flex flex-wrap items-end gap-2">
          <button className="crm-button crm-button-primary text-sm" type="submit">
            Apply filters
          </button>
          <Link className="crm-button crm-button-secondary text-sm" href="/opportunities">
            Reset
          </Link>
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
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const followUp = followUpLabel(record.nextFollowUpAt);

                return (
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
                    <div className="space-y-2">
                      <StatusBadge tone={followUp.tone}>{followUp.label}</StatusBadge>
                      <p>{formatDate(record.nextFollowUpAt)}</p>
                    </div>
                    <p className="text-xs text-[var(--muted)]">Updated {formatDate(record.updatedAt)}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-[var(--muted)]">{splitLabel(record.splits)}</td>
                  <td className="px-4 py-4 align-top">
                    <Link className="font-semibold text-[var(--accent-strong)] hover:underline" href={`/customer-360/${record.leadCustomer.id}`}>
                      Customer 360
                    </Link>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
