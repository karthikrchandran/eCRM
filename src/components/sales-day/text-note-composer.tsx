"use client";

import { useActionState } from "react";
import { createSalesTextNoteAction } from "@/server/sales-day/actions";
import type { MyDayLookups } from "@/server/sales-day/queries";
import type { MyDayTaskRecord, SalesDayActionState } from "@/server/sales-day/types";

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

export function TextNoteComposer({ lookups, tasks }: { lookups: MyDayLookups; tasks: MyDayTaskRecord[] }) {
  const [state, formAction, pending] = useActionState(createSalesTextNoteAction, initialState);

  return (
    <form action={formAction} className="surface grid gap-4 p-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Note
        <textarea
          className="crm-control min-h-28"
          name="body"
          placeholder="Capture meeting context, customer asks, pricing notes, or follow-up details"
          required
        />
      </label>
      <FieldError errors={state.fieldErrors?.body} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
          Task
          <select className="crm-control" defaultValue="" name="taskId">
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

      {state.message ? (
        <p className={`text-sm font-medium ${state.ok ? "text-[var(--status-positive-text)]" : "text-red-700"}`}>{state.message}</p>
      ) : null}

      <div className="crm-form-actions">
        <button className="crm-button crm-button-primary text-sm" disabled={pending} type="submit">
          {pending ? "Saving..." : "Save note"}
        </button>
      </div>
    </form>
  );
}
