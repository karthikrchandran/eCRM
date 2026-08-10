import { notFound } from "next/navigation";
import { ContactDetail } from "@/components/crm/contact-detail";
import { requireUser } from "@/server/auth/current-user";
import { getContactDetail } from "@/server/crm/queries";

export default async function ContactDetailPage({ params }: { params: Promise<{ contactId: string }> }) {
  const user = await requireUser();
  const { contactId } = await params;
  const contact = await getContactDetail(user, contactId);

  if (!contact) {
    notFound();
  }

  return <ContactDetail contact={contact} />;
}
