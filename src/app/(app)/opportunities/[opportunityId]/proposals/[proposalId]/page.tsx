import { notFound } from "next/navigation";
import { ProposalDetail } from "@/components/proposals/proposal-detail";
import { requireUser } from "@/server/auth/current-user";
import { addProposalPdfMetadataAction, changeProposalStatusAction } from "@/server/proposals/actions";
import { getProposalDetail } from "@/server/proposals/queries";

export default async function ProposalDetailPage({
  params
}: {
  params: Promise<{ opportunityId: string; proposalId: string }>;
}) {
  const user = await requireUser();
  const { opportunityId, proposalId } = await params;
  const proposal = await getProposalDetail(user, proposalId);

  if (!proposal || proposal.opportunityId !== opportunityId) {
    notFound();
  }

  const pdfAction = addProposalPdfMetadataAction.bind(null, opportunityId, proposal.id);
  const statusAction = changeProposalStatusAction.bind(null, opportunityId, proposal.id);

  return <ProposalDetail pdfMetadataAction={pdfAction} proposal={proposal} statusAction={statusAction} />;
}
