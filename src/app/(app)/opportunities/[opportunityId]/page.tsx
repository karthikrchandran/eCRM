import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { moveOpportunityStageAction } from "@/server/opportunities/actions";
import { getOpportunityDetail, listOpportunityFormOptions } from "@/server/opportunities/queries";
import { listProposalsForOpportunity } from "@/server/proposals/queries";

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
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

export default async function OpportunityDetailPage({ params }: { params: Promise<{ opportunityId: string }> }) {
  const user = await requireUser();
  const { opportunityId } = await params;
  const [opportunity, options, proposals] = await Promise.all([
    getOpportunityDetail(user, opportunityId),
    listOpportunityFormOptions(),
    listProposalsForOpportunity(user, opportunityId)
  ]);

  if (!opportunity) {
    notFound();
  }

  const moveAction = moveOpportunityStageAction.bind(null, opportunity.id);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{opportunity.title}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {opportunity.leadCustomer.name} - {opportunity.stage.name} - Owner {opportunity.owner.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold" href="/opportunities">
            Back
          </Link>
          <Link className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white" href={`/opportunities/${opportunity.id}/edit`}>
            Edit
          </Link>
        </div>
      </header>

      <section className="surface grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Lead/customer</p>
          <p className="font-medium">{opportunity.leadCustomer.name}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Branch</p>
          <p className="font-medium">{opportunity.branch?.name ?? "Company level"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Value</p>
          <p className="font-medium">{formatAmount(opportunity.estimatedValueInr)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Probability</p>
          <p className="font-medium">{opportunity.probability !== null ? `${opportunity.probability}%` : "Not set"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Product/service interest</p>
          <p className="font-medium">{opportunity.productInterest ?? "Not set"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Last reach</p>
          <p className="font-medium">{formatDate(opportunity.lastReachAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Next follow-up</p>
          <p className="font-medium">{formatDate(opportunity.nextFollowUpAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Updated</p>
          <p className="font-medium">{formatDate(opportunity.updatedAt)}</p>
        </div>
        {opportunity.notes ? <p className="sm:col-span-2 lg:col-span-4">{opportunity.notes}</p> : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="surface p-4">
          <h2 className="text-lg font-semibold">Owner splits</h2>
          {opportunity.splits.length === 0 ? <p className="mt-3 text-sm text-[var(--muted)]">No split owners configured.</p> : null}
          <div className="mt-3 space-y-2">
            {opportunity.splits.map((split) => (
              <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] py-3" key={split.userId}>
                <div>
                  <p className="font-medium">{split.user.name}</p>
                  <p className="text-xs text-[var(--muted)]">{split.user.email}</p>
                </div>
                <p className="font-semibold">{split.percent}%</p>
              </div>
            ))}
          </div>
        </div>

        <form action={moveAction} className="surface grid gap-3 p-4">
          <h2 className="text-lg font-semibold">Move stage</h2>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Stage
            <select className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue={opportunity.stageId} name="stageId">
              {options.stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold" type="submit">
            Move opportunity
          </button>
        </form>
      </section>

      <section className="surface p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Proposals</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Commercial proposals and uploaded Canva PDF metadata.</p>
          </div>
          <Link
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
            href={`/opportunities/${opportunity.id}/proposals/new`}
          >
            New proposal
          </Link>
        </div>

        {proposals.length === 0 ? <p className="mt-4 text-sm text-[var(--muted)]">No proposals created yet.</p> : null}
        <div className="mt-4 space-y-3">
          {proposals.map((proposal) => (
            <article className="rounded-md border border-[var(--border)] p-3" key={proposal.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Link
                    className="font-semibold text-[var(--accent-strong)] hover:underline"
                    href={`/opportunities/${opportunity.id}/proposals/${proposal.id}`}
                  >
                    {proposal.title}
                  </Link>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Sequence {proposal.sequenceNumber}
                    {proposal.versionLabel ? ` - ${proposal.versionLabel}` : ""} - {proposal.status}
                  </p>
                </div>
                <p className="text-sm font-semibold">{formatAmount((proposal.totalPaisa / 100).toFixed(2))}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
