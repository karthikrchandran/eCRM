import Link from "next/link";
import type { CustomerTimelineItem } from "@/server/crm/queries";
import { StatusBadge } from "@/components/ui/sales-primitives";

function formatDate(date: Date) {
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

export function CustomerTimeline({ items }: { items: CustomerTimelineItem[] }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Customer 360 timeline</h2>
        <p className="text-sm text-[var(--muted)]">A combined view of sales activity, notes, commercial movement, production, and finance events.</p>
      </div>
      {items.length === 0 ? <p className="surface p-4 text-sm text-[var(--muted)]">No timeline activity yet.</p> : null}
      <div className="space-y-3">
        {items.map((item) => (
          <article className="surface grid gap-3 p-4 sm:grid-cols-[150px_1fr]" key={`${item.kind}:${item.id}`}>
            <div className="space-y-2">
              <StatusBadge tone={item.kind === "payment" ? "success" : item.kind === "cost" || item.kind === "follow_up" ? "warning" : "info"}>
                {kindLabels[item.kind]}
              </StatusBadge>
              <p className="text-xs text-[var(--muted)]">{formatDate(item.occurredAt)}</p>
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
  );
}
