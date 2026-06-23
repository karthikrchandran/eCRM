import Link from "next/link";
import { notFound } from "next/navigation";
import { Customer360Workspace } from "@/components/crm/customer-360-workspace";
import { MetricStrip, PageHeader } from "@/components/ui/sales-primitives";
import { requireUser } from "@/server/auth/current-user";
import { getCustomer360Timeline, getLeadCustomerDetail } from "@/server/crm/queries";

export default async function Customer360DetailPage({ params }: { params: Promise<{ leadId: string }> }) {
  const user = await requireUser();
  const { leadId } = await params;
  const [lead, timeline] = await Promise.all([getLeadCustomerDetail(user, leadId), getCustomer360Timeline(user, leadId)]);

  if (!lead) {
    notFound();
  }

  const openActivities = lead.activities.filter((activity) => activity.status === "OPEN");
  const primaryContact = lead.contacts.find((contact) => contact.isPrimary) ?? lead.contacts[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Link className="crm-button crm-button-secondary text-sm" href={`/leads/${lead.id}`}>
              Lead detail
            </Link>
            <Link className="crm-button crm-button-primary text-sm" href={`/leads/${lead.id}/activities/new`}>
              Add follow-up
            </Link>
          </>
        }
        description={`${lead.state} owned by ${lead.owner.name}. This page is the direct Customer 360 view for sales, delivery, and finance context.`}
        eyebrow="Customer 360"
        title={lead.name}
      />

      <MetricStrip
        metrics={[
          { label: "Open follow-ups", value: openActivities.length.toString(), detail: openActivities[0]?.subject ?? "No open activity due" },
          { label: "Contacts", value: lead.contacts.length.toString(), detail: primaryContact?.name ?? "No contacts yet" },
          { label: "Branches", value: lead.branches.length.toString(), detail: lead.branches[0]?.name ?? "No branches yet" },
          { label: "Timeline items", value: timeline.length.toString(), detail: "Tasks, notes, proposals, orders, production, finance" }
        ]}
      />

      <Customer360Workspace lead={lead} timeline={timeline} />
    </div>
  );
}
