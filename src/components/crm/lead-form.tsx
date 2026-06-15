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
    <form action={formAction} className="surface grid max-w-3xl gap-4 p-6">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Lead/customer name
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2"
          defaultValue={initialValues?.name ?? ""}
          name="name"
          required
          type="text"
        />
      </label>
      <FieldError errors={state.fieldErrors?.name} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          State
          <select className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue={initialValues?.state ?? "LEAD"} name="state">
            <option value="LEAD">LEAD</option>
            <option value="CUSTOMER">CUSTOMER</option>
            <option value="DORMANT">DORMANT</option>
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
      </div>
      <FieldError errors={state.fieldErrors?.ownerId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Industry
          <input
            className="rounded-md border border-[var(--border)] px-3 py-2"
            defaultValue={initialValues?.industry ?? ""}
            name="industry"
            type="text"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Source
          <input
            className="rounded-md border border-[var(--border)] px-3 py-2"
            defaultValue={initialValues?.source ?? ""}
            name="source"
            type="text"
          />
        </label>
      </div>

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
        <button className="rounded-md bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={pending} type="submit">
          {pending ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
