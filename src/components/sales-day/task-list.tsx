import type { MyDayTaskRecord } from "@/server/sales-day/types";
import { EmptyState } from "@/components/ui/sales-primitives";
import { TaskRow } from "./task-row";

type TaskListProps = {
  overdueTasks: MyDayTaskRecord[];
  openTasks: MyDayTaskRecord[];
  completedTasks: MyDayTaskRecord[];
};

function TaskSection({
  emptyText,
  tasks,
  title
}: {
  emptyText: string;
  tasks: MyDayTaskRecord[];
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-white">
      <div className="border-b border-[var(--border)] bg-slate-50 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
      </div>
      {tasks.length ? (
        <div>
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      ) : (
        <div className="px-4 py-5 text-sm text-[var(--muted)]">{emptyText}</div>
      )}
    </section>
  );
}

export function TaskList({ completedTasks, openTasks, overdueTasks }: TaskListProps) {
  if (!completedTasks.length && !openTasks.length && !overdueTasks.length) {
    return (
      <EmptyState
        title="No tasks planned"
        description="Add calls, follow-ups, proposal work, or reminders to shape the day."
      />
    );
  }

  return (
    <div className="space-y-4">
      <TaskSection emptyText="No overdue work." tasks={overdueTasks} title="Overdue" />
      <TaskSection emptyText="No open tasks for this day." tasks={openTasks} title="Focus list" />
      <TaskSection emptyText="Nothing completed yet." tasks={completedTasks} title="Completed today" />
    </div>
  );
}
