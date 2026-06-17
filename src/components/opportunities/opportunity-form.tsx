"use client";

import { useActionState } from "react";
import type { ActionState } from "@/server/opportunities/types";

type Owner = {
  id: string;
  name: string;
  email: string;
};

type LeadOption = {
  id: string;
  name: string;
  state: string;
};

type BranchOption = {
  id: string;
  name: string;
  leadCustomerId: string;
};

type StageOption = {
  id: string;
  name: string;
};

type OpportunityInitialValues = {
  leadCustomerId: string;
  branchId: string | null;
  stageId: string;
  ownerId: string;
  title: string;
  productInterest: string | null;
  estimatedValueInr: unknown;
  probability: number | null;
  lastReachAt: Date | null;
  nextFollowUpAt: Date | null;
  notes: string | null;
};

type SplitInitialValue = {
  userId: string;
  percent: number;
};

type OpportunityFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  branches: BranchOption[];
  initialSplits?: SplitInitialValue[];
  initialValues?: OpportunityInitialValues;
  leads: LeadOption[];
  owners: Owner[];
  stages: StageOption[];
  submitLabel: string;
};

const initialState: ActionState = { ok: false };

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? (
    <p className="text-sm font-medium text-red-700" role="alert">
      {errors[0]}
    </p>
  ) : null;
}

function formatDateTimeLocal(date: Date | null | undefined) {
  return date ? new Date(date).toISOString().slice(0, 16) : "";
}

function amountValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return value.toString();
}

export function OpportunityForm({
  action,
  branches,
  initialSplits,
  initialValues,
  leads,
  owners,
  stages,
  submitLabel
}: OpportunityFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const splitRows = initialSplits?.length ? initialSplits : [{ userId: "", percent: 100 }];

  return (
    <form action={formAction} className="surface grid max-w-5xl gap-4 p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Lead/customer
          <select
            className="rounded-md border border-[var(--border)] px-3 py-2"
            defaultValue={initialValues?.leadCustomerId ?? ""}
            name="leadCustomerId"
            required
          >
            <option value="">Choose lead/customer</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.name} ({lead.state})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Branch
          <select className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue={initialValues?.branchId ?? ""} name="branchId">
            <option value="">Company level</option>
            {branches.map((branch) => {
              const lead = leads.find((candidate) => candidate.id === branch.leadCustomerId);

              return (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                  {lead ? ` - ${lead.name}` : ""}
                </option>
              );
            })}
          </select>
        </label>
      </div>
      <FieldError errors={state.fieldErrors?.leadCustomerId} />
      <FieldError errors={state.fieldErrors?.branchId} />

      <label className="flex flex-col gap-1 text-sm font-medium">
        Opportunity title
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2"
          defaultValue={initialValues?.title ?? ""}
          name="title"
          required
          type="text"
        />
      </label>
      <FieldError errors={state.fieldErrors?.title} />

      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Stage
          <select className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue={initialValues?.stageId ?? ""} name="stageId" required>
            <option value="">Choose stage</option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Owner
          <select className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue={initialValues?.ownerId ?? ""} name="ownerId" required>
            <option value="">Choose owner</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name} ({owner.email})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Product/service interest
          <input
            className="rounded-md border border-[var(--border)] px-3 py-2"
            defaultValue={initialValues?.productInterest ?? ""}
            name="productInterest"
            type="text"
          />
        </label>
      </div>
      <FieldError errors={state.fieldErrors?.stageId} />
      <FieldError errors={state.fieldErrors?.ownerId} />

      <div className="grid gap-4 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Estimated value INR
          <input
            className="rounded-md border border-[var(--border)] px-3 py-2"
            defaultValue={amountValue(initialValues?.estimatedValueInr)}
            min="0"
            name="estimatedValueInr"
            step="0.01"
            type="number"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Probability
          <input
            className="rounded-md border border-[var(--border)] px-3 py-2"
            defaultValue={initialValues?.probability ?? ""}
            max="100"
            min="0"
            name="probability"
            type="number"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Last reach
          <input
            className="rounded-md border border-[var(--border)] px-3 py-2"
            defaultValue={formatDateTimeLocal(initialValues?.lastReachAt)}
            name="lastReachAt"
            type="datetime-local"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Next follow-up
          <input
            className="rounded-md border border-[var(--border)] px-3 py-2"
            defaultValue={formatDateTimeLocal(initialValues?.nextFollowUpAt)}
            name="nextFollowUpAt"
            type="datetime-local"
          />
        </label>
      </div>
      <FieldError errors={state.fieldErrors?.estimatedValueInr} />
      <FieldError errors={state.fieldErrors?.probability} />
      <FieldError errors={state.fieldErrors?.lastReachAt} />
      <FieldError errors={state.fieldErrors?.nextFollowUpAt} />

      <fieldset className="grid gap-3 rounded-md border border-[var(--border)] p-4">
        <legend className="px-1 text-sm font-semibold">Owner splits</legend>
        {splitRows.map((split, index) => (
          <div className="grid gap-3 md:grid-cols-[1fr_160px]" key={`${split.userId}-${index}`}>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Split owner
              <select className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue={split.userId} name="splitUserId">
                <option value="">No split owner</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name} ({owner.email})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Percent
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2"
                defaultValue={split.percent}
                max="100"
                min="1"
                name="splitPercent"
                type="number"
              />
            </label>
          </div>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Notes
        <textarea
          className="min-h-28 rounded-md border border-[var(--border)] px-3 py-2"
          defaultValue={initialValues?.notes ?? ""}
          name="notes"
        />
      </label>

      {state.message ? <p className="text-sm text-[var(--muted)]">{state.message}</p> : null}

      <div>
        <button className="crm-button crm-button-primary" disabled={pending} type="submit">
          {pending ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
