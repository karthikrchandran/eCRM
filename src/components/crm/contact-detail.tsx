import Link from "next/link";
import { StatusBadge } from "@/components/ui/sales-primitives";
import type { ContactDetailRecord } from "@/server/crm/queries";

export function ContactDetail({ contact }: { contact: ContactDetailRecord }) {
  const lead = contact.leadCustomer;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="break-words text-2xl font-semibold text-slate-950">{contact.name}</h1>
            <StatusBadge tone={contact.isPrimary ? "success" : "neutral"}>{contact.isPrimary ? "Primary contact" : "Contact"}</StatusBadge>
          </div>
          <p className="break-words text-sm text-[var(--muted)]">
            {contact.designation ?? "Designation not set"}
            {contact.branch ? ` - ${contact.branch.name}` : " - Company level"}
          </p>
          <p className="text-sm text-[var(--muted)]">
            Lead/customer:{" "}
            <Link className="font-semibold text-[var(--accent-strong)] hover:underline" href={`/leads/${lead.id}`}>
              {lead.name}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="crm-button crm-button-secondary text-sm" href="/contacts">
            Back to contacts
          </Link>
          <Link className="crm-button crm-button-secondary text-sm" href={`/contacts/${contact.id}/edit`}>
            Edit contact
          </Link>
          <Link className="crm-button crm-button-secondary text-sm" href={`/leads/${lead.id}`}>
            Open lead
          </Link>
          <Link className="crm-button crm-button-secondary text-sm" href={`/customer-360/${lead.id}`}>
            Customer 360
          </Link>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="surface space-y-4 p-4">
          <h2 className="text-lg font-semibold">Contact profile</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-[var(--muted)]">Email</p>
              <p className="break-words font-medium">{contact.email ?? "No email"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-[var(--muted)]">Phone</p>
              <p className="break-words font-medium">{contact.phone ?? "No phone"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-[var(--muted)]">Branch</p>
              <p className="break-words font-medium">{contact.branch?.name ?? "Company level"}</p>
              <p className="text-sm text-[var(--muted)]">
                {[contact.branch?.city, contact.branch?.region].filter(Boolean).join(", ") || "Location not set"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-[var(--muted)]">Primary</p>
              <p className="font-medium">{contact.isPrimary ? "Yes" : "No"}</p>
            </div>
          </div>
          {contact.notes ? (
            <div>
              <p className="text-xs uppercase text-[var(--muted)]">Notes</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{contact.notes}</p>
            </div>
          ) : null}
        </article>

      </section>
    </div>
  );
}
