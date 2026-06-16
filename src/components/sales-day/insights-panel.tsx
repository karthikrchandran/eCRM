import type { MyDayInsightItem, MyDayInsightsViewModel } from "@/server/sales-day/types";
import { EmptyState, StatusBadge } from "@/components/ui/sales-primitives";

function InsightList({ empty, items, title }: { empty: string; items: MyDayInsightItem[]; title: string }) {
  return (
    <section className="surface p-4">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      {items.length ? (
        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <article className="rounded-md border border-[var(--border)] bg-white p-3" key={item.id}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-slate-950">{item.title}</h3>
                {item.linkedRecord ? <StatusBadge tone="neutral">{item.linkedRecord.label}</StatusBadge> : null}
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">{item.detail}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--muted)]">{empty}</p>
      )}
    </section>
  );
}

export function InsightsPanel({ insights }: { insights: MyDayInsightsViewModel }) {
  const hasAny =
    insights.suggestedTomorrowTasks.length ||
    insights.accountsNeedingAttention.length ||
    insights.voiceNoteSummaries.length ||
    insights.carryForwardTasks.length;

  if (!hasAny) {
    return (
      <EmptyState
        title="No planning insights yet"
        description="As tasks, voice notes, and follow-up dates accumulate, this view will suggest tomorrow planning items."
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <InsightList
        empty="No suggested tasks for tomorrow."
        items={insights.suggestedTomorrowTasks}
        title="Suggested tomorrow plan"
      />
      <InsightList
        empty="No accounts need special attention."
        items={insights.accountsNeedingAttention}
        title="Accounts needing attention"
      />
      <InsightList empty="No voice-note summaries yet." items={insights.voiceNoteSummaries} title="Voice note summaries" />
      <section className="surface p-4">
        <h2 className="text-base font-semibold text-slate-950">Carry-forward unfinished work</h2>
        {insights.carryForwardTasks.length ? (
          <div className="mt-3 space-y-3">
            {insights.carryForwardTasks.map((task) => (
              <article className="rounded-md border border-[var(--border)] bg-white p-3" key={task.id}>
                <h3 className="font-semibold text-slate-950">{task.title}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{task.description ?? "Open task can be moved during review."}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">No unfinished work to carry forward.</p>
        )}
      </section>
    </div>
  );
}
