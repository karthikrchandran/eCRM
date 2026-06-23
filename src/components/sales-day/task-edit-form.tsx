"use client";

import { useActionState } from "react";
import { updateSalesTaskAction } from "@/server/sales-day/actions";
import type { MyDayLookups } from "@/server/sales-day/queries";
import type { MyDayTaskRecord, SalesDayActionState } from "@/server/sales-day/types";

const initialState: SalesDayActionState = { ok: false };

function datetimeLocalValue(date?: Date | null) {
  return date ? date.toISOString().slice(0, 16) : "";
}

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

export function TaskEditForm({ lookups, task }: { lookups: MyDayLookups; task: MyDayTaskRecord }) {
  const [state, formAction, pending] = useActionState(updateSalesTaskAction.bind(null, task.id), initialState);

  return (
    <form action={formAction} className="mt-4 grid gap-3 rounded-md border border-[var(--border)] bg-slate-50 p-3">
      <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr]">
        <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
          Edit task title
          <input className="crm-control" defaultValue={task.title} name="title" required />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
          Type
          <select className="crm-control" defaultValue={task.type} name="type">
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
          <select className="crm-control" defaultValue={task.priority} name="priority">
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </label>
      </div>
      <FieldError errors={state.fieldErrors?.title} />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
          Due
          <input className="crm-control" defaultValue={datetimeLocalValue(task.dueAt)} name="dueAt" type="datetime-local" />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
          Lead/customer
          <select className="crm-control" defaultValue={task.leadCustomer?.id ?? ""} name="leadCustomerId">
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
          <select className="crm-control" defaultValue={task.opportunity?.id ?? ""} name="opportunityId">
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
          <select className="crm-control" defaultValue={task.proposal?.id ?? ""} name="proposalId">
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
          <select className="crm-control" defaultValue={task.order?.id ?? ""} name="orderId">
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
        <textarea className="crm-control min-h-20" defaultValue={task.description ?? ""} name="description" />
      </label>

      {state.message ? (
        <p className={`text-sm font-medium ${state.ok ? "text-[var(--status-positive-text)]" : "text-red-700"}`}>{state.message}</p>
      ) : null}

      <div className="crm-form-actions">
        <button className="crm-button crm-button-primary text-sm" disabled={pending} type="submit">
          {pending ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}
