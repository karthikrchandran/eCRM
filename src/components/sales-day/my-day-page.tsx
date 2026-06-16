import Link from "next/link";
import type { MyDayLookups } from "@/server/sales-day/queries";
import type { MyDayInsightsViewModel, MyDayViewModel } from "@/server/sales-day/types";
import { MetricStrip, PageHeader } from "@/components/ui/sales-primitives";
import { EndOfDayReview } from "./end-of-day-review";
import { InsightsPanel } from "./insights-panel";
import { TaskComposer } from "./task-composer";
import { TaskList } from "./task-list";
import { VoiceNotePanel } from "./voice-note-panel";
import { VoiceNoteRecorder } from "./voice-note-recorder";

type MyDayPageProps = {
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
    ? "rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
    : "rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-[var(--surface-muted)]";
}

export function MyDayPage({ activeView, insights, lookups, myDay }: MyDayPageProps) {
  const date = dateValue(myDay.date);
  const allTasks = [...myDay.overdueTasks, ...myDay.openTasks, ...myDay.completedTasks];
  const voiceNotes = allTasks.flatMap((task) => task.voiceNotes);

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
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <TaskList completedTasks={myDay.completedTasks} openTasks={myDay.openTasks} overdueTasks={myDay.overdueTasks} />
          <div className="space-y-4">
            <TaskComposer lookups={lookups} />
            <VoiceNoteRecorder tasks={allTasks} />
            <VoiceNotePanel notes={voiceNotes} />
          </div>
        </div>
      ) : activeView === "insights" ? (
        <InsightsPanel insights={insights} />
      ) : (
        <EndOfDayReview date={myDay.date} tasks={allTasks} />
      )}
    </div>
  );
}
