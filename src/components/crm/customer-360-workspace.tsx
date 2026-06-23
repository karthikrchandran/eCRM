"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CustomerTimelineItem, LeadCustomerDetail } from "@/server/crm/queries";
import { StatusBadge } from "@/components/ui/sales-primitives";

type TimelineFilter = "all" | "sales" | "notes" | "delivery" | "money";

const filterLabels: Record<TimelineFilter, string> = {
  all: "All",
  delivery: "Delivery",
  money: "Money",
  notes: "Notes",
  sales: "Sales"
};

const filterKinds: Record<Exclude<TimelineFilter, "all">, CustomerTimelineItem["kind"][]> = {
  delivery: ["production"],
  money: ["invoice", "payment", "cost"],
  notes: ["text_note", "voice_note"],
  sales: ["activity", "follow_up", "task", "opportunity", "proposal", "order"]
};

const kindLabels: Record<CustomerTimelineItem["kind"], string> = {
  activity: "Activity",
  cost: "Cost",
  follow_up: "Follow-up",
  invoice: "Invoice",
  opportunity: "Opportunity",
  order: "Order",
  payment: "Payment",
  production: "Production",
  proposal: "Proposal",
  task: "Task",
  text_note: "Typed note",
  voice_note: "Voice note"
};

function formatDate(date: Date | null) {
  return date ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date) : "Not set";
}

function formatTimelineDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function formatAmount(amount: NonNullable<CustomerTimelineItem["amount"]>) {
  const locale = amount.currency === "USD" ? "en-US" : "en-IN";
  return `${amount.currency} ${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(amount.minorUnits / 100)}`;
}

function getFilteredItems(items: CustomerTimelineItem[], filter: TimelineFilter) {
  if (filter === "all") {
    return items;
  }

  return items.filter((item) => filterKinds[filter].includes(item.kind));
}

function getCount(items: CustomerTimelineItem[], filter: TimelineFilter) {
  return getFilteredItems(items, filter).length;
}

function itemTone(kind: CustomerTimelineItem["kind"]) {
  if (kind === "payment") {
    return "success" as const;
  }

  if (kind === "cost" || kind === "follow_up") {
    return "warning" as const;
  }

  return "info" as const;
}

export function Customer360Workspace({ lead, timeline }: { lead: LeadCustomerDetail; timeline: CustomerTimelineItem[] }) {
  const [activeFilter, setActiveFilter] = useState<TimelineFilter>("all");
  const primaryContact = lead.contacts.find((contact) => contact.isPrimary) ?? lead.contacts[0] ?? null;
  const primaryBranch = primaryContact?.branch ?? lead.branches[0] ?? null;
  const openActivities = lead.activities.filter((activity) => activity.status === "OPEN");
  const filteredItems = useMemo(() => getFilteredItems(timeline, activeFilter), [activeFilter, timeline]);
  const filters: TimelineFilter[] = ["all", "sales", "notes", "delivery", "money"];

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[minmax(280px,380px)_1fr]">
        <aside className="space-y-4">
          <section className="surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Account</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">Customer profile</h2>
              </div>
              <StatusBadge tone={lead.state === "CUSTOMER" ? "success" : lead.state === "DORMANT" ? "warning" : "info"}>{lead.state}</StatusBadge>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Owner</p>
                <p className="font-medium text-slate-950">Owned by {lead.owner.name}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Industry</p>
                  <p className="font-medium">{lead.industry ?? "Not set"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Source</p>
                  <p className="font-medium">{lead.source ?? "Not set"}</p>
                </div>
              </div>
              {primaryBranch ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Primary branch</p>
                  <p className="font-medium">{primaryBranch.name}</p>
                  <p className="text-[var(--muted)]">{[primaryBranch.city, primaryBranch.region].filter(Boolean).join(", ") || "Location not set"}</p>
                </div>
              ) : null}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Updated</p>
                <p className="font-medium">{formatDate(lead.updatedAt)}</p>
              </div>
            </div>
          </section>

          <section className="surface p-4">
            <h2 className="text-lg font-semibold text-slate-950">Contacts</h2>
            <div className="mt-3 space-y-3">
              {lead.contacts.length === 0 ? <p className="text-sm text-[var(--muted)]">No contacts yet.</p> : null}
              {lead.contacts.slice(0, 4).map((contact) => (
                <article className="rounded-md border border-[var(--border)] p-3 text-sm" key={contact.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-950">{contact.name}</p>
                      <p className="text-[var(--muted)]">{contact.designation ?? contact.branch?.name ?? "Stakeholder"}</p>
                    </div>
                    {contact.isPrimary ? <StatusBadge tone="success">Primary</StatusBadge> : null}
                  </div>
                  <p className="mt-2 text-[var(--muted)]">{contact.email ?? contact.phone ?? "No email or phone"}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">Open work</h2>
              <StatusBadge tone={openActivities.length ? "warning" : "success"}>{openActivities.length ? `${openActivities.length} open` : "Clear"}</StatusBadge>
            </div>
            <div className="mt-3 space-y-3">
              {openActivities.length === 0 ? <p className="text-sm text-[var(--muted)]">No open follow-ups.</p> : null}
              {openActivities.slice(0, 4).map((activity) => (
                <article className="rounded-md border border-[var(--border)] p-3 text-sm" key={activity.id}>
                  <p className="font-medium text-slate-950">{activity.subject}</p>
                  <p className="text-[var(--muted)]">
                    {activity.type} due {formatDate(activity.dueAt)}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </aside>

        <section className="surface min-w-0 p-4">
          <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Command stream</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">Customer activity stream</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Sales activity, notes, commercial movement, delivery, and finance in one filtered stream.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => {
                const isActive = activeFilter === filter;
                return (
                  <button
                    aria-pressed={isActive}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                      isActive
                        ? "border-[var(--accent-strong)] bg-[var(--accent-strong)] text-white"
                        : "border-[var(--border)] bg-white text-[var(--brand-navy)] hover:border-[var(--accent-strong)]"
                    }`}
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    type="button"
                  >
                    {filterLabels[filter]} {getCount(timeline, filter)}
                  </button>
                );
              })}
            </div>
          </div>

          <div aria-label="Customer activity stream" className="mt-4 space-y-3" role="region">
            {filteredItems.length === 0 ? <p className="rounded-md border border-[var(--border)] p-4 text-sm text-[var(--muted)]">No activity in this view.</p> : null}
            {filteredItems.map((item) => (
              <article className="grid gap-3 rounded-md border border-[var(--border)] p-4 sm:grid-cols-[130px_1fr]" key={`${item.kind}:${item.id}`}>
                <div className="space-y-2">
                  <StatusBadge tone={itemTone(item.kind)}>{kindLabels[item.kind]}</StatusBadge>
                  <p className="text-xs text-[var(--muted)]">{formatTimelineDate(item.occurredAt)}</p>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="break-words font-semibold text-slate-950">{item.title}</h3>
                    {item.amount ? <p className="text-sm font-semibold text-[var(--brand-navy)]">{formatAmount(item.amount)}</p> : null}
                  </div>
                  {item.detail ? <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--muted)]">{item.detail}</p> : null}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                    {item.actor ? <span>Owner {item.actor}</span> : null}
                    {item.href ? (
                      <Link className="font-semibold text-[var(--brand-navy)]" href={item.href}>
                        Open record
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
