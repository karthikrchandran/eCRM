import Link from "next/link";
import { notFound } from "next/navigation";
import { ProposalForm } from "@/components/proposals/proposal-form";
import { requireUser } from "@/server/auth/current-user";
import { getOpportunityDetail } from "@/server/opportunities/queries";
import { createProposalAction } from "@/server/proposals/actions";
import { listActiveProductServices } from "@/server/products/queries";

export default async function NewProposalPage({ params }: { params: Promise<{ opportunityId: string }> }) {
  const user = await requireUser();
  const { opportunityId } = await params;
  const [opportunity, products] = await Promise.all([getOpportunityDetail(user, opportunityId), listActiveProductServices(user)]);

  if (!opportunity) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">New proposal</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {opportunity.title} - {opportunity.leadCustomer.name} - {opportunity.stage.name}
          </p>
        </div>
        <Link className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold" href={`/opportunities/${opportunity.id}`}>
          Back to opportunity
        </Link>
      </header>

      {products.length === 0 ? (
        <section className="surface p-4 text-sm text-[var(--muted)]">No active products or services are available for proposal lines.</section>
      ) : null}

      <ProposalForm action={createProposalAction} opportunityId={opportunity.id} products={products} submitLabel="Create proposal" />
    </div>
  );
}
