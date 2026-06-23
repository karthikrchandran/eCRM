"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createSalesTaskAction } from "@/server/sales-day/actions";
import type { MyDayLookups } from "@/server/sales-day/queries";
import type { SalesDayActionState } from "@/server/sales-day/types";

const initialState: SalesDayActionState = { ok: false };

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) {
    return null;
  }

  return (
    <p className="text-sm font-medium text-red-700" role="alert">
      {errors[0]}
    </p>
  );
}

export function TaskComposer({ lookups }: { lookups: MyDayLookups }) {
  const [state, formAction, pending] = useActionState(createSalesTaskAction, initialState);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="crm-button crm-button-primary text-sm" onClick={() => setOpen(true)} type="button">
        Add new task
      </button>

      {open ? (
        <div aria-labelledby="add-task-dialog-title" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog">
          <section className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-950" id="add-task-dialog-title">
                  Add new task
                </h3>
                <p className="mt-1 text-sm text-[var(--muted)]">Create a call, follow-up, reminder, or CRM update for this day.</p>
              </div>
              <button aria-label="Close task dialog" className="crm-button crm-button-secondary text-sm" onClick={() => setOpen(false)} type="button">
                Close
              </button>
            </div>

            <form action={formAction} className="mt-5 grid gap-4">
              <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr_1fr]">
                <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
                  Task title
                  <input className="crm-control" name="title" placeholder="Call customer, send proposal, follow up" required />
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
                  Type
                  <select className="crm-control" defaultValue="CALL" name="type">
                    <option value="CALL">Call</option>
                    <option value="EMAIL">Email</option>
                    <option value="FOLLOW_UP">Follow-up</option>
                    <option value="SEND_MATERIAL">Send material</option>
                    <option value="MEETING">Meeting</option>
                    <option value="CRM_UPDATE">CRM update</option>
                    <option value="CUSTOM">Custom</option>
                  </select>
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
                  Priority
                  <select className="crm-control" defaultValue="MEDIUM" name="priority">
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </label>
              </div>
              <FieldError errors={state.fieldErrors?.title} />

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
                  Due
                  <input className="crm-control" name="dueAt" type="datetime-local" />
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
                  Lead/customer
                  <select className="crm-control" defaultValue="" name="leadCustomerId">
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
                  <select className="crm-control" defaultValue="" name="opportunityId">
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
                  <select className="crm-control" defaultValue="" name="proposalId">
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
                  <select className="crm-control" defaultValue="" name="orderId">
                    <option value="">None</option>
                    {lookups.orders.map((record) => (
                      <option key={record.id} value={record.id}>
                        {record.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Notes
                <textarea className="crm-control min-h-20" name="description" placeholder="Client context, materials to send, risks" />
              </label>

              {state.message ? <p className="text-sm text-[var(--muted)]">{state.message}</p> : null}

              <div className="crm-form-actions">
                <button className="crm-button crm-button-primary text-sm" disabled={pending} type="submit">
                  {pending ? "Adding..." : "Add task"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
