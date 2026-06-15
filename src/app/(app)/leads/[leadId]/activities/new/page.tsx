import { notFound } from "next/navigation";
import { ActivityForm } from "@/components/crm/activity-form";
import { requireUser } from "@/server/auth/current-user";
import { createActivityAction } from "@/server/crm/actions";
import { getLeadCustomerDetail, listCrmOwners } from "@/server/crm/queries";

export default async function NewActivityPage({ params }: { params: Promise<{ leadId: string }> }) {
  const user = await requireUser();
  const { leadId } = await params;
  const [lead, owners] = await Promise.all([getLeadCustomerDetail(user, leadId), listCrmOwners()]);

  if (!lead) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New activity for {lead.name}</h1>
      <ActivityForm action={createActivityAction.bind(null, lead.id)} branches={lead.branches} contacts={lead.contacts} owners={owners} />
    </div>
  );
}
