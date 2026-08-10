import Link from "next/link";
import { StatusBadge } from "@/components/ui/sales-primitives";

type ProposalVersionRecord = {
  id: string;
  opportunityId: string;
  sequenceNumber: number;
  versionLabel: string | null;
  status: string;
  updatedAt: Date;
  totalPaisa: number;
  currency: string;
  order?: { id: string; orderNumber: string } | null;
};

function formatPaisa(value: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(value / 100)}`;
}

export function ProposalVersionList({
  opportunityId,
  proposals
}: {
  opportunityId: string;
  proposals: ProposalVersionRecord[];
}) {
  const latestProposalId = proposals[0]?.id;

  return (
    <section className="surface space-y-4 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Proposal versions</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Manage proposal versions here. Old versions stay visible, but edits happen by creating a new version.
          </p>
        </div>
        <Link className="crm-button crm-button-primary text-sm" href={`/opportunities/${opportunityId}/proposals/new`}>
          Create new version
        </Link>
      </div>

      {proposals.length === 0 ? <p className="text-sm text-[var(--muted)]">No proposals created yet.</p> : null}

      <div className="space-y-3">
        {proposals.map((proposal) => (
          <article className="rounded-md border border-[var(--border)] p-3" key={proposal.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    className="font-semibold text-[var(--accent-strong)] hover:underline"
                    href={`/opportunities/${proposal.opportunityId}/proposals/${proposal.id}`}
                  >
                    Version {proposal.sequenceNumber}
                    {proposal.versionLabel ? ` - ${proposal.versionLabel}` : ""}
                  </Link>
                  {proposal.id === latestProposalId ? <StatusBadge tone="info">Latest</StatusBadge> : null}
                  <StatusBadge tone="neutral">{proposal.status}</StatusBadge>
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Updated {new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(proposal.updatedAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  className="crm-button crm-button-secondary text-sm"
                  href={`/opportunities/${proposal.opportunityId}/proposals/${proposal.id}`}
                >
                  Open
                </Link>
                {proposal.status === "ACCEPTED" && !proposal.order ? (
                  <Link
                    className="crm-button crm-button-primary text-sm"
                    href={`/opportunities/${proposal.opportunityId}/proposals/${proposal.id}/book-order`}
                  >
                    Book order
                  </Link>
                ) : null}
                {proposal.order ? (
                  <Link className="crm-button crm-button-primary text-sm" href={`/orders/${proposal.order.id}`}>
                    View order {proposal.order.orderNumber}
                  </Link>
                ) : null}
              </div>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">{formatPaisa(proposal.totalPaisa, proposal.currency)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
