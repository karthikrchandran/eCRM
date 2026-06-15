import Link from "next/link";

type Stage = {
  id: string;
  name: string;
  sortOrder: number;
  kind: "OPEN" | "WON" | "LOST" | "DORMANT";
  active: boolean;
};

type OpportunityCard = {
  id: string;
  title: string;
  productInterest: string | null;
  estimatedValueInr: unknown;
  probability: number | null;
  nextFollowUpAt: Date | null;
  leadCustomer: { name: string };
  branch: { name: string } | null;
  owner: { name: string };
};

type OpportunityBoardProps = {
  stages: Stage[];
  recordsByStage: Record<string, OpportunityCard[]>;
};

function formatAmount(value: unknown) {
  if (value === null || value === undefined) {
    return "Value not set";
  }

  const amount = Number(value.toString());

  if (!Number.isFinite(amount)) {
    return "Value not set";
  }

  return `INR ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(amount)}`;
}

function formatDate(date: Date | null) {
  if (!date) {
    return "No follow-up";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

export function OpportunityBoard({ recordsByStage, stages }: OpportunityBoardProps) {
  const orderedStages = [...stages].sort((left, right) => left.sortOrder - right.sortOrder);

  return (
    <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {orderedStages.map((stage) => {
        const records = recordsByStage[stage.id] ?? [];

        return (
          <section className="surface min-h-48 p-3" key={stage.id}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-semibold">{stage.name}</h2>
              <span className="rounded bg-slate-100 px-2 py-1 text-xs text-[var(--muted)]">{records.length}</span>
            </div>

            {records.length === 0 ? <p className="text-sm text-[var(--muted)]">No opportunities in this stage.</p> : null}

            <div className="space-y-3">
              {records.map((record) => (
                <article className="rounded-md border border-[var(--border)] bg-white p-3" key={record.id}>
                  <Link className="font-semibold text-[var(--accent-strong)] hover:underline" href={`/opportunities/${record.id}`}>
                    {record.title}
                  </Link>
                  <p className="mt-1 text-sm text-[var(--muted)]">{record.leadCustomer.name}</p>
                  <p className="mt-2 text-sm">
                    {formatAmount(record.estimatedValueInr)}
                    {record.probability !== null ? ` - ${record.probability}%` : ""}
                  </p>
                  <p className="text-sm text-[var(--muted)]">Owner: {record.owner.name}</p>
                  <p className="text-sm text-[var(--muted)]">Follow-up: {formatDate(record.nextFollowUpAt)}</p>
                  {record.branch ? <p className="text-sm text-[var(--muted)]">Branch: {record.branch.name}</p> : null}
                  {record.productInterest ? <p className="mt-2 text-sm">{record.productInterest}</p> : null}
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
