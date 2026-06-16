import { acceptSuggestedActionAction, rejectSuggestedActionAction } from "@/server/sales-day/actions";
import type { MyDaySuggestedActionRecord } from "@/server/sales-day/types";
import { StatusBadge } from "@/components/ui/sales-primitives";

function formatDue(date?: Date | null) {
  if (!date) {
    return "No due date suggested";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function SuggestedActionsPanel({ actions }: { actions: MyDaySuggestedActionRecord[] }) {
  if (!actions.length) {
    return null;
  }

  return (
    <div className="mt-4 rounded-md border border-[var(--border)] bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Actions are drafts until accepted.</p>
      <div className="mt-3 space-y-3">
        {actions.map((action) => (
          <article className="rounded-md border border-[var(--border)] bg-white p-3" data-testid={`suggested-action-${action.id}`} key={action.id}>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-semibold text-slate-950">{action.title}</h4>
              <StatusBadge tone="info">{action.type.replaceAll("_", " ")}</StatusBadge>
            </div>
            {action.description ? <p className="mt-1 text-sm text-slate-700">{action.description}</p> : null}
            <p className="mt-2 text-xs text-[var(--muted)]">
              {formatDue(action.suggestedDueAt)}
              {action.confidenceLabel ? ` | ${action.confidenceLabel} confidence` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={acceptSuggestedActionAction.bind(null, action.id)}>
                <button className="crm-button crm-button-primary text-sm" type="submit">
                  Create task
                </button>
              </form>
              <form action={rejectSuggestedActionAction.bind(null, action.id)}>
                <button className="crm-button crm-button-secondary text-sm" type="submit">
                  Reject
                </button>
              </form>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
