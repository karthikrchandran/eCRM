import Link from "next/link";
import { notFound } from "next/navigation";
import { OpportunityForm } from "@/components/opportunities/opportunity-form";
import { requireUser } from "@/server/auth/current-user";
import { updateOpportunityAction } from "@/server/opportunities/actions";
import { getOpportunityDetail, listOpportunityFormOptions } from "@/server/opportunities/queries";

export default async function EditOpportunityPage({ params }: { params: Promise<{ opportunityId: string }> }) {
  const user = await requireUser();
  const { opportunityId } = await params;
  const [opportunity, options] = await Promise.all([getOpportunityDetail(user, opportunityId), listOpportunityFormOptions()]);

  if (!opportunity) {
    notFound();
  }

  const action = updateOpportunityAction.bind(null, opportunity.id);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Edit opportunity</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{opportunity.title}</p>
        </div>
        <Link className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold" href={`/opportunities/${opportunity.id}`}>
          Back to detail
        </Link>
      </header>

      <OpportunityForm
        action={action}
        branches={options.branches}
        initialSplits={opportunity.splits.map((split) => ({ percent: split.percent, userId: split.userId }))}
        initialValues={{
          branchId: opportunity.branchId,
          estimatedValueInr: opportunity.estimatedValueInr?.toString() ?? null,
          lastReachAt: opportunity.lastReachAt,
          leadCustomerId: opportunity.leadCustomerId,
          nextFollowUpAt: opportunity.nextFollowUpAt,
          notes: opportunity.notes,
          ownerId: opportunity.ownerId,
          probability: opportunity.probability,
          productInterest: opportunity.productInterest,
          stageId: opportunity.stageId,
          title: opportunity.title
        }}
        leads={options.leads}
        owners={options.owners}
        stages={options.stages}
        submitLabel="Save opportunity"
      />
    </div>
  );
}
