"use client";

import { useActionState } from "react";
import { deleteSalesTextNoteAction, updateSalesTextNoteAction } from "@/server/sales-day/actions";
import type { MyDayLookups } from "@/server/sales-day/queries";
import type { MyDayTaskRecord, MyDayTextNoteRecord, SalesDayActionState } from "@/server/sales-day/types";

const initialState: SalesDayActionState = { ok: false };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(date);
}

function linkedLabels(note: MyDayTextNoteRecord) {
  return [note.task, note.leadCustomer, note.opportunity, note.proposal, note.order].filter(Boolean).map((record) => record!.label);
}

function NoteEditForm({ lookups, note, tasks }: { lookups: MyDayLookups; note: MyDayTextNoteRecord; tasks: MyDayTaskRecord[] }) {
  const [state, formAction, pending] = useActionState(updateSalesTextNoteAction.bind(null, note.id), initialState);
  const deleteAction = deleteSalesTextNoteAction.bind(null, note.id);

  return (
    <details className="mt-3 rounded-md border border-[var(--border)] bg-slate-50 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-[var(--brand-navy)]">Edit note</summary>
      <form action={formAction} className="mt-3 grid gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Note
          <textarea className="crm-control min-h-24" defaultValue={note.body} name="body" required />
        </label>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
            Task
            <select className="crm-control" defaultValue={note.task?.id ?? ""} name="taskId">
              <option value="">None</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
            Lead/customer
            <select className="crm-control" defaultValue={note.leadCustomer?.id ?? ""} name="leadCustomerId">
              <option value="">None</option>
              {lookups.leadCustomers.map((record) => (
                <option key={record.id} value={record.id}>
                  {record.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
            Opportunity
            <select className="crm-control" defaultValue={note.opportunity?.id ?? ""} name="opportunityId">
              <option value="">None</option>
              {lookups.opportunities.map((record) => (
                <option key={record.id} value={record.id}>
                  {record.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
            Proposal
            <select className="crm-control" defaultValue={note.proposal?.id ?? ""} name="proposalId">
              <option value="">None</option>
              {lookups.proposals.map((record) => (
                <option key={record.id} value={record.id}>
                  {record.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
            Order
            <select className="crm-control" defaultValue={note.order?.id ?? ""} name="orderId">
              <option value="">None</option>
              {lookups.orders.map((record) => (
                <option key={record.id} value={record.id}>
                  {record.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {state.message ? (
          <p className={`text-sm font-medium ${state.ok ? "text-[var(--status-positive-text)]" : "text-red-700"}`}>{state.message}</p>
        ) : null}

        <div className="crm-form-actions">
          <button className="crm-button crm-button-primary text-sm" disabled={pending} type="submit">
            {pending ? "Saving..." : "Save note"}
          </button>
        </div>
      </form>
      <form action={deleteAction} className="mt-3">
        <button className="crm-button crm-button-secondary text-sm" type="submit">
          Delete note
        </button>
      </form>
    </details>
  );
}

export function TextNotePanel({
  lookups,
  notes,
  tasks
}: {
  lookups: MyDayLookups;
  notes: MyDayTextNoteRecord[];
  tasks: MyDayTaskRecord[];
}) {
  if (notes.length === 0) {
    return (
      <div className="surface p-4">
        <p className="text-sm text-[var(--muted)]">No typed notes for this day.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notes.map((note) => {
        const links = linkedLabels(note);

        return (
          <article className="surface p-4" key={note.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{formatDate(note.createdAt)}</p>
              {links.length ? <p className="text-xs text-[var(--muted)]">{links.join(" | ")}</p> : null}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800">{note.body}</p>
            <NoteEditForm lookups={lookups} note={note} tasks={tasks} />
          </article>
        );
      })}
    </div>
  );
}
