import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderBookingForm } from "@/components/orders/order-booking-form";
import { bookOrderAction } from "@/server/orders/actions";
import { requireUser } from "@/server/auth/current-user";
import { loadAcceptedProposalForBooking } from "@/server/orders/queries";

function formatPaisa(value: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(value / 100)}`;
}

export default async function BookOrderPage({
  params
}: {
  params: Promise<{ opportunityId: string; proposalId: string }>;
}) {
  const user = await requireUser();
  const { opportunityId, proposalId } = await params;
  const proposal = await loadAcceptedProposalForBooking(user, proposalId);

  if (!proposal || proposal.opportunityId !== opportunityId) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Book order</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {proposal.title} - {proposal.opportunity.leadCustomer.name} - {formatPaisa(proposal.totalPaisa, proposal.currency)}
          </p>
        </div>
        <Link className="crm-button crm-button-secondary" href={`/opportunities/${opportunityId}/proposals/${proposalId}`}>
          Back to proposal
        </Link>
      </header>

      <OrderBookingForm action={bookOrderAction} proposalId={proposal.id} />
    </div>
  );
}
