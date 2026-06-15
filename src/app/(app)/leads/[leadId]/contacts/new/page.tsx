import { notFound } from "next/navigation";
import { ContactForm } from "@/components/crm/contact-form";
import { requireUser } from "@/server/auth/current-user";
import { createContactAction } from "@/server/crm/actions";
import { getLeadCustomerDetail } from "@/server/crm/queries";

export default async function NewContactPage({ params }: { params: Promise<{ leadId: string }> }) {
  const user = await requireUser();
  const { leadId } = await params;
  const lead = await getLeadCustomerDetail(user, leadId);

  if (!lead) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New contact for {lead.name}</h1>
      <ContactForm action={createContactAction.bind(null, lead.id)} branches={lead.branches} />
    </div>
  );
}
