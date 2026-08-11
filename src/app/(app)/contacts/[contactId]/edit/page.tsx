import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/crm/contact-form";
import { requireUser } from "@/server/auth/current-user";
import { updateContactAction } from "@/server/crm/actions";
import { getContactDetail, getLeadCustomerDetail } from "@/server/crm/queries";

export default async function EditContactPage({ params }: { params: Promise<{ contactId: string }> }) {
  const user = await requireUser();
  const { contactId } = await params;
  const contact = await getContactDetail(user, contactId);
  if (!contact) notFound();
  const lead = await getLeadCustomerDetail(user, contact.leadCustomer.id);
  if (!lead) notFound();

  return <div className="space-y-6"><header className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold">Edit contact</h1><p className="mt-1 text-sm text-[var(--muted)]">{contact.name}</p></div><Link className="crm-button crm-button-secondary text-sm" href={`/contacts/${contact.id}`}>Back to contact</Link></header><ContactForm action={updateContactAction.bind(null, contact.id, contact.leadCustomer.id)} branches={lead.branches} initialValues={contact} submitLabel="Save contact" /></div>;
}
