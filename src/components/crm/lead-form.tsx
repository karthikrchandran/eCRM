"use client";

import { useActionState } from "react";
import type { ActionState } from "@/server/crm/types";

type LeadFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  owners: Array<{ id: string; name: string; email: string }>;
  initialValues?: {
    name: string;
    state: "LEAD" | "CUSTOMER" | "DORMANT";
    ownerId: string;
    industry: string | null;
    source: string | null;
    notes: string | null;
  };
  submitLabel: string;
};

const initialState: ActionState = { ok: false };

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

export function LeadForm({ action, owners, initialValues, submitLabel }: LeadFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="surface grid w-full max-w-3xl gap-4 p-4 sm:p-6">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Lead/customer name
        <input
          className="crm-control"
          defaultValue={initialValues?.name ?? ""}
          name="name"
          required
          type="text"
        />
      </label>
      <FieldError errors={state.fieldErrors?.name} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          State
          <select className="crm-control" defaultValue={initialValues?.state ?? "LEAD"} name="state">
            <option value="LEAD">LEAD</option>
            <option value="CUSTOMER">CUSTOMER</option>
            <option value="DORMANT">DORMANT</option>
          </select>
        </label>

        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          Owner
          <select className="crm-control" defaultValue={initialValues?.ownerId ?? ""} name="ownerId" required>
            <option value="">Choose owner</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name} ({owner.email})
              </option>
            ))}
          </select>
        </label>
      </div>
      <FieldError errors={state.fieldErrors?.ownerId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          Industry
          <input
            className="crm-control"
            defaultValue={initialValues?.industry ?? ""}
            name="industry"
            type="text"
          />
        </label>

        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          Source
          <input
            className="crm-control"
            defaultValue={initialValues?.source ?? ""}
            name="source"
            type="text"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Notes
        <textarea
          className="crm-control min-h-28"
          defaultValue={initialValues?.notes ?? ""}
          name="notes"
        />
      </label>

      {state.message ? <p className="text-sm text-[var(--muted)]">{state.message}</p> : null}

      <div className="crm-form-actions">
        <button className="crm-button crm-button-primary sm:w-auto" disabled={pending} type="submit">
          {pending ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
