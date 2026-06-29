import { ContactList } from "@/components/crm/contact-list";
import { requireUser } from "@/server/auth/current-user";
import { listContacts } from "@/server/crm/queries";
import { contactFilterSchema } from "@/server/crm/validators";

export default async function ContactsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const rawSearchParams = await searchParams;
  const filters = contactFilterSchema.parse({
    q: rawSearchParams.q,
    ownerId: rawSearchParams.ownerId,
    state: rawSearchParams.state
  });
  const { records, owners } = await listContacts(user, filters);

  return <ContactList filters={filters} owners={owners} records={records} />;
}
