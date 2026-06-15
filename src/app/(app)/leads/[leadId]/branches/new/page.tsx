import { notFound } from "next/navigation";
import { BranchForm } from "@/components/crm/branch-form";
import { requireUser } from "@/server/auth/current-user";
import { createBranchAction } from "@/server/crm/actions";
import { getLeadCustomerDetail } from "@/server/crm/queries";

export default async function NewBranchPage({ params }: { params: Promise<{ leadId: string }> }) {
  const user = await requireUser();
  const { leadId } = await params;
  const lead = await getLeadCustomerDetail(user, leadId);

  if (!lead) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New branch for {lead.name}</h1>
      <BranchForm action={createBranchAction.bind(null, lead.id)} />
    </div>
  );
}
