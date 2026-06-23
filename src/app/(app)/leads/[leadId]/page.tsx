import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerTimeline } from "@/components/crm/customer-timeline";
import { ReassignOwnerForm } from "@/components/crm/reassign-owner-form";
import { requireUser } from "@/server/auth/current-user";
import { completeActivityAction, reassignLeadOwnerAction } from "@/server/crm/actions";
import { getCustomer360Timeline, getLeadCustomerDetail, listCrmOwners } from "@/server/crm/queries";

function formatDate(date: Date | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

const detailActionClass = "crm-button crm-button-secondary w-full text-sm sm:w-auto";

export default async function LeadDetailPage({ params }: { params: Promise<{ leadId: string }> }) {
  const user = await requireUser();
  const { leadId } = await params;
  const [lead, owners, timeline] = await Promise.all([
    getLeadCustomerDetail(user, leadId),
    listCrmOwners(),
    getCustomer360Timeline(user, leadId)
  ]);

  if (!lead) {
    notFound();
  }

  const reassignAction = reassignLeadOwnerAction.bind(null, lead.id);
  const nextOwners = owners.filter((owner) => owner.id !== lead.ownerId);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold">{lead.name}</h1>
          <p className="mt-1 break-words text-sm text-[var(--muted)]">
            {lead.state} owned by {lead.owner.name}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <Link className={detailActionClass} href={`/leads/${lead.id}/edit`}>
            Edit
          </Link>
          <Link className={detailActionClass} href={`/customer-360/${lead.id}`}>
            Customer 360
          </Link>
          <Link className={detailActionClass} href={`/leads/${lead.id}/branches/new`}>
            Add branch
          </Link>
          <Link className={detailActionClass} href={`/leads/${lead.id}/contacts/new`}>
            Add contact
          </Link>
          <Link className={detailActionClass} href={`/leads/${lead.id}/activities/new`}>
            Add activity
          </Link>
        </div>
      </header>

      <section className="surface grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="min-w-0">
          <p className="text-xs uppercase text-[var(--muted)]">Industry</p>
          <p className="break-words font-medium">{lead.industry ?? "Not set"}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase text-[var(--muted)]">Source</p>
          <p className="break-words font-medium">{lead.source ?? "Not set"}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase text-[var(--muted)]">Created</p>
          <p className="break-words font-medium">{formatDate(lead.createdAt)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase text-[var(--muted)]">Updated</p>
          <p className="break-words font-medium">{formatDate(lead.updatedAt)}</p>
        </div>
        {lead.notes ? <p className="whitespace-pre-wrap break-words text-sm sm:col-span-2 lg:col-span-4">{lead.notes}</p> : null}
      </section>

      <CustomerTimeline items={timeline} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Branches</h2>
        {lead.branches.length === 0 ? <p className="text-sm text-[var(--muted)]">No branches yet.</p> : null}
        <div className="grid gap-3 md:grid-cols-2">
          {lead.branches.map((branch) => (
            <article className="surface min-w-0 p-4" key={branch.id}>
              <h3 className="break-words font-semibold">{branch.name}</h3>
              <p className="break-words text-sm text-[var(--muted)]">
                {[branch.city, branch.region].filter(Boolean).join(", ") || "Location not set"}
              </p>
              {branch.gstin ? <p className="mt-2 break-words text-sm">GSTIN: {branch.gstin}</p> : null}
              {branch.salesContext ? <p className="mt-2 whitespace-pre-wrap break-words text-sm">{branch.salesContext}</p> : null}
              {branch.notes ? <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--muted)]">{branch.notes}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Contacts</h2>
        {lead.contacts.length === 0 ? <p className="text-sm text-[var(--muted)]">No contacts yet.</p> : null}
        <div className="grid gap-3 md:grid-cols-2">
          {lead.contacts.map((contact) => (
            <article className="surface min-w-0 p-4" key={contact.id}>
              <h3 className="break-words font-semibold">{contact.name}</h3>
              <p className="break-words text-sm text-[var(--muted)]">
                {contact.designation ?? "Designation not set"}
                {contact.branch ? ` - ${contact.branch.name}` : " - Company level"}
              </p>
              <p className="mt-2 break-words text-sm">{contact.email ?? "No email"}</p>
              <p className="break-words text-sm">{contact.phone ?? "No phone"}</p>
              {contact.isPrimary ? <p className="mt-2 text-sm font-medium text-[var(--accent-strong)]">Primary contact</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Activities</h2>
        {lead.activities.length === 0 ? <p className="text-sm text-[var(--muted)]">No activities yet.</p> : null}
        <div className="space-y-3">
          {lead.activities.map((activity) => {
            const completeAction = completeActivityAction.bind(null, lead.id, activity.id);

            return (
              <article className="surface flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between" key={activity.id}>
                <div className="min-w-0">
                  <h3 className="break-words font-semibold">{activity.subject}</h3>
                  <p className="break-words text-sm text-[var(--muted)]">
                    {activity.type} - {activity.status} - Owner {activity.owner.name}
                  </p>
                  <p className="mt-2 break-words text-sm">
                    Branch: {activity.branch?.name ?? "Company level"} - Contact: {activity.contact?.name ?? "None"}
                  </p>
                  <p className="break-words text-sm text-[var(--muted)]">
                    Occurred {formatDate(activity.occurredAt)} - Due {formatDate(activity.dueAt)}
                  </p>
                </div>
                {activity.status === "OPEN" ? (
                  <form action={completeAction} className="sm:shrink-0">
                    <button className={detailActionClass} type="submit">
                      Complete
                    </button>
                  </form>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <div className="min-w-0 space-y-3">
          <h2 className="text-lg font-semibold">Ownership history</h2>
          {lead.ownershipHistory.length === 0 ? <p className="text-sm text-[var(--muted)]">No owner changes yet.</p> : null}
          <div className="space-y-3">
            {lead.ownershipHistory.map((history) => (
              <article className="surface min-w-0 p-4" key={history.id}>
                <p className="break-words font-medium">
                  {history.fromOwner?.name ?? "Unassigned"} to {history.toOwner.name}
                </p>
                <p className="break-words text-sm text-[var(--muted)]">
                  Changed by {history.changedBy.name} on {formatDate(history.createdAt)}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">{history.reason}</p>
              </article>
            ))}
          </div>
        </div>
        <div className="min-w-0 space-y-3">
          <h2 className="text-lg font-semibold">Reassign owner</h2>
          <ReassignOwnerForm action={reassignAction} owners={nextOwners} />
        </div>
      </section>
    </div>
  );
}
