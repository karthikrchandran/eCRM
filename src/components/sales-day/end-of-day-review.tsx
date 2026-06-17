"use client";

import { useActionState } from "react";
import { saveEndOfDayReviewAction } from "@/server/sales-day/actions";
import type { MyDayTaskRecord } from "@/server/sales-day/types";
import type { SalesDayActionState } from "@/server/sales-day/types";

const initialState: SalesDayActionState = { ok: false };

function dateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function defaultStatus(task: MyDayTaskRecord) {
  return task.status === "COMPLETED" ? "DONE" : "MOVE_TO_TOMORROW";
}

export function EndOfDayReview({ date, tasks }: { date: Date; tasks: MyDayTaskRecord[] }) {
  const [state, formAction, pending] = useActionState(saveEndOfDayReviewAction, initialState);

  if (!tasks.length) {
    return (
      <section className="surface p-5">
        <h2 className="text-base font-semibold text-slate-950">End-of-day review</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">No tasks are available for review on this date.</p>
      </section>
    );
  }

  return (
    <form action={formAction} className="surface space-y-4 p-4">
      <div>
        <h2 className="text-base font-semibold text-slate-950">End-of-day review</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Choose what happened to each task before saving the day.</p>
      </div>
      <input name="reviewDate" type="hidden" value={dateValue(date)} />

      <div className="overflow-hidden rounded-lg border border-[var(--border)]">
        {tasks.map((task) => (
          <div
            aria-label={`Review ${task.title}`}
            className="grid gap-3 border-t border-[var(--border)] bg-white p-4 first:border-t-0 md:grid-cols-[1fr_14rem_1fr]"
            key={task.id}
            role="group"
          >
            <input name="taskId" type="hidden" value={task.id} />
            <div>
              <h3 className="font-semibold text-slate-950">{task.title}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{task.description ?? task.type.replaceAll("_", " ")}</p>
            </div>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Outcome
              <select className="crm-control" defaultValue={defaultStatus(task)} name={`status:${task.id}`}>
                <option value="DONE">Done</option>
                <option value="MOVE_TO_TOMORROW">Move to tomorrow</option>
                <option value="BLOCKED">Blocked</option>
                <option value="WAITING_ON_CUSTOMER">Waiting on customer</option>
                <option value="CANCEL">Cancel</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Note
              <input className="crm-control" name={`note:${task.id}`} placeholder="Optional context" />
            </label>
          </div>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Daily notes
        <textarea className="crm-control min-h-24" name="notes" placeholder="Overall summary, risks, help needed" />
      </label>

      {state.message ? <p className="text-sm text-[var(--muted)]">{state.message}</p> : null}

      <div className="crm-form-actions">
        <button className="crm-button crm-button-primary text-sm" disabled={pending} type="submit">
          {pending ? "Saving..." : "Save review"}
        </button>
      </div>
    </form>
  );
}
