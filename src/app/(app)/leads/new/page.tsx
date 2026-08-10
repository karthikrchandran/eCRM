import { LeadForm } from "@/components/crm/lead-form";
import { createLeadCustomerAction } from "@/server/crm/actions";
import { listCrmOwners } from "@/server/crm/queries";
import { requireUser } from "@/server/auth/current-user";

export default async function NewLeadPage() {
  const user = await requireUser();
  const owners = await listCrmOwners(user);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New lead/customer</h1>
      <LeadForm action={createLeadCustomerAction} owners={owners} submitLabel="Create lead/customer" />
    </div>
  );
}
