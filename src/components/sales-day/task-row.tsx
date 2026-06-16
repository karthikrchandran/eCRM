import { clsx } from "clsx";
import { cancelSalesTaskAction, completeSalesTaskAction, reopenSalesTaskAction } from "@/server/sales-day/actions";
import type { MyDayTaskRecord } from "@/server/sales-day/types";
import { StatusBadge } from "@/components/ui/sales-primitives";

const completedClassName = "opacity-60 saturate-50 [filter:blur(0.2px)]";

function formatTime(date?: Date | null) {
  if (!date) {
    return "No time";
  }

  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function priorityTone(priority: MyDayTaskRecord["priority"]) {
  if (priority === "URGENT") return "danger" as const;
  if (priority === "HIGH") return "warning" as const;
  if (priority === "LOW") return "neutral" as const;
  return "info" as const;
}

function linkedContext(task: MyDayTaskRecord) {
  return [task.leadCustomer, task.opportunity, task.proposal, task.order].filter(Boolean).map((item) => item?.label);
}

export function TaskRow({ task }: { task: MyDayTaskRecord }) {
  const completed = task.status === "COMPLETED";
  const links = linkedContext(task);

  return (
    <article
      className={clsx(
        "grid gap-3 border-t border-[var(--border)] px-4 py-4 text-sm first:border-t-0 md:grid-cols-[1fr_auto]",
        completed && completedClassName
      )}
      data-testid={`sales-task-row-${task.id}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-slate-950">{task.title}</h3>
          <StatusBadge tone={priorityTone(task.priority)}>{task.priority}</StatusBadge>
          <StatusBadge tone={completed ? "success" : task.status === "CANCELLED" ? "danger" : "neutral"}>{task.status}</StatusBadge>
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {task.type.replaceAll("_", " ")} | {formatTime(task.dueAt)}
        </p>
        {task.description ? <p className="mt-2 text-sm text-slate-700">{task.description}</p> : null}
        {links.length ? <p className="mt-2 text-xs text-[var(--muted)]">{links.join(" | ")}</p> : null}
      </div>

      <div className="flex flex-wrap items-start gap-2 md:justify-end">
        {completed ? (
          <form action={reopenSalesTaskAction.bind(null, task.id)}>
            <button className="crm-button crm-button-secondary text-sm" type="submit">
              Reopen
            </button>
          </form>
        ) : (
          <>
            <form action={completeSalesTaskAction.bind(null, task.id)}>
              <button className="crm-button crm-button-primary text-sm" type="submit">
                Complete
              </button>
            </form>
            {task.status !== "CANCELLED" ? (
              <form action={cancelSalesTaskAction.bind(null, task.id)}>
                <button className="crm-button crm-button-secondary text-sm" type="submit">
                  Cancel
                </button>
              </form>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}
