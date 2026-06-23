import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerTimeline } from "@/components/crm/customer-timeline";
import { MetricStrip, PageHeader, StatusBadge } from "@/components/ui/sales-primitives";
import { requireUser } from "@/server/auth/current-user";
import { getCustomer360Timeline, getLeadCustomerDetail } from "@/server/crm/queries";

function formatDate(date: Date | null) {
  return date ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date) : "Not set";
}

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

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="surface grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-[var(--muted)]">Industry</p>
            <p className="font-medium">{lead.industry ?? "Not set"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-[var(--muted)]">Source</p>
            <p className="font-medium">{lead.source ?? "Not set"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-[var(--muted)]">Primary contact</p>
            <p className="font-medium">{primaryContact?.name ?? "Not set"}</p>
            {primaryContact ? <p className="text-sm text-[var(--muted)]">{primaryContact.email ?? primaryContact.phone ?? "No email or phone"}</p> : null}
          </div>
          <div>
            <p className="text-xs uppercase text-[var(--muted)]">Updated</p>
            <p className="font-medium">{formatDate(lead.updatedAt)}</p>
          </div>
        </div>

        <aside className="surface p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Open follow-ups</h2>
            <StatusBadge tone={openActivities.length ? "warning" : "success"}>{openActivities.length ? "Needs action" : "Clear"}</StatusBadge>
          </div>
          <div className="mt-3 space-y-3">
            {openActivities.length === 0 ? <p className="text-sm text-[var(--muted)]">No open follow-ups.</p> : null}
            {openActivities.slice(0, 4).map((activity) => (
              <article className="rounded-md border border-[var(--border)] p-3 text-sm" key={activity.id}>
                <p className="font-medium">{activity.subject}</p>
                <p className="text-[var(--muted)]">
                  {activity.type} due {formatDate(activity.dueAt)}
                </p>
              </article>
            ))}
          </div>
        </aside>
      </section>

      <CustomerTimeline items={timeline} />
    </div>
  );
}
