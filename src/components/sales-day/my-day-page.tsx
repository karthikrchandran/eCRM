import Link from "next/link";
import type { MyDayLookups } from "@/server/sales-day/queries";
import type { MyDayInsightsViewModel, MyDayViewModel } from "@/server/sales-day/types";
import { MetricStrip, PageHeader } from "@/components/ui/sales-primitives";
import { EndOfDayReview } from "./end-of-day-review";
import { InsightsPanel } from "./insights-panel";
import { TaskComposer } from "./task-composer";
import { TaskList } from "./task-list";
import { TextNoteComposer } from "./text-note-composer";
import { TextNotePanel } from "./text-note-panel";
import { VoiceNotePanel } from "./voice-note-panel";
import { VoiceNoteRecorder } from "./voice-note-recorder";

type MyDayPageProps = {
  activeNoteView: "written" | "voice";
  activeView: "today" | "insights" | "review";
  insights: MyDayInsightsViewModel;
  lookups: MyDayLookups;
  myDay: MyDayViewModel;
};

function dateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getMetrics(myDay: MyDayViewModel) {
  const allToday = [...myDay.openTasks, ...myDay.completedTasks];
  const callCount = allToday.filter((task) => task.type === "CALL").length;

  return [
    { label: "Planned", value: myDay.openTasks.length.toString(), detail: "Open focus items" },
    { label: "Overdue", value: myDay.overdueTasks.length.toString(), detail: "Needs attention" },
    { label: "Completed", value: myDay.completedTasks.length.toString(), detail: "Still visible" },
    { label: "Calls", value: callCount.toString(), detail: "Call work today" }
  ];
}

function tabClassName(active: boolean) {
  return active
    ? "rounded-md bg-[var(--brand-navy)] px-3 py-2 text-sm font-semibold text-white"
    : "rounded-md px-3 py-2 text-sm font-semibold text-[var(--brand-navy)] hover:bg-[var(--surface-muted)]";
}

function noteHref(date: string, note: "written" | "voice") {
  return `/my-day?date=${date}&view=today&note=${note}`;
}

export function MyDayPage({ activeNoteView, activeView, insights, lookups, myDay }: MyDayPageProps) {
  const date = dateValue(myDay.date);
  const allTasks = [...myDay.overdueTasks, ...myDay.openTasks, ...myDay.completedTasks];
  const voiceNotes = [...myDay.voiceNotes, ...allTasks.flatMap((task) => task.voiceNotes)];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Personal sales workspace"
        title="My Day"
        description="Plan sales work, keep completed items visible, and capture call notes without changing CRM records automatically."
      />

      <MetricStrip metrics={getMetrics(myDay)} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2" aria-label="My Day views">
          <Link className={tabClassName(activeView === "today")} href={`/my-day?date=${date}&view=today`}>
            Today
          </Link>
          <Link className={tabClassName(activeView === "insights")} href={`/my-day?date=${date}&view=insights`}>
            Insights
          </Link>
          <Link className={tabClassName(activeView === "review")} href={`/my-day?date=${date}&view=review`}>
            End-of-Day Review
          </Link>
        </nav>
        <form action="/my-day" className="flex items-end gap-2" method="get">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Date
            <input className="crm-control min-h-10 text-sm normal-case" defaultValue={date} name="date" type="date" />
          </label>
          <input name="view" type="hidden" value={activeView} />
          <button className="crm-button crm-button-secondary text-sm" type="submit">
            Go
          </button>
        </form>
      </div>

      {activeView === "today" ? (
        <div className="space-y-6">
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">What is in store</h2>
                <p className="text-sm text-[var(--muted)]">Overdue work, today&apos;s focus list, and completed items stay visible.</p>
              </div>
              <TaskComposer lookups={lookups} />
            </div>
            <TaskList
              completedTasks={myDay.completedTasks}
              lookups={lookups}
              openTasks={myDay.openTasks}
              overdueTasks={myDay.overdueTasks}
            />
          </section>

          <section className="space-y-4 border-t border-[var(--border)] pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Daily notes</h2>
                <p className="text-sm text-[var(--muted)]">
                  Switch between written notes and voice notes without keeping both work areas open.
                </p>
              </div>
              <nav aria-label="Note type" className="flex rounded-lg border border-[var(--border)] bg-white p-1">
                <Link className={tabClassName(activeNoteView === "written")} href={noteHref(date, "written")}>
                  Written
                </Link>
                <Link className={tabClassName(activeNoteView === "voice")} href={noteHref(date, "voice")}>
                  Voice
                </Link>
              </nav>
            </div>
            {activeNoteView === "written" ? (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <TextNoteComposer lookups={lookups} tasks={allTasks} />
                </div>
                <TextNotePanel lookups={lookups} notes={myDay.textNotes} tasks={allTasks} />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <VoiceNoteRecorder tasks={allTasks} />
                </div>
                <VoiceNotePanel notes={voiceNotes} />
              </div>
            )}
          </section>
        </div>
      ) : activeView === "insights" ? (
        <InsightsPanel insights={insights} />
      ) : (
        <EndOfDayReview date={myDay.date} tasks={allTasks} />
      )}
    </div>
  );
}
