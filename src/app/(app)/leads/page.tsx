import { LeadList } from "@/components/crm/lead-list";
import { requireUser } from "@/server/auth/current-user";
import { listLeadCustomers } from "@/server/crm/queries";
import { leadFilterSchema } from "@/server/crm/validators";

export default async function LeadsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const rawSearchParams = await searchParams;
  const filters = leadFilterSchema.parse({
    q: rawSearchParams.q,
    ownerId: rawSearchParams.ownerId,
    state: rawSearchParams.state,
    followUp: rawSearchParams.followUp
  });
  const { records, owners } = await listLeadCustomers(user, filters);

  return <LeadList filters={filters} owners={owners} records={records} />;
}
