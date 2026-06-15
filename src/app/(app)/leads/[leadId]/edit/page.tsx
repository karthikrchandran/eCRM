import { notFound } from "next/navigation";
import { LeadForm } from "@/components/crm/lead-form";
import { requireUser } from "@/server/auth/current-user";
import { updateLeadCustomerAction } from "@/server/crm/actions";
import { getLeadCustomerDetail, listCrmOwners } from "@/server/crm/queries";

export default async function EditLeadPage({ params }: { params: Promise<{ leadId: string }> }) {
  const user = await requireUser();
  const { leadId } = await params;
  const [lead, owners] = await Promise.all([getLeadCustomerDetail(user, leadId), listCrmOwners()]);

  if (!lead) {
    notFound();
  }

  const action = updateLeadCustomerAction.bind(null, lead.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit lead/customer</h1>
      <LeadForm
        action={action}
        initialValues={{
          name: lead.name,
          state: lead.state,
          ownerId: lead.ownerId,
          industry: lead.industry,
          source: lead.source,
          notes: lead.notes
        }}
        owners={owners}
        submitLabel="Save lead/customer"
      />
    </div>
  );
}
