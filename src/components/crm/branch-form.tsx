"use client";

import { useActionState } from "react";
import type { ActionState } from "@/server/crm/types";

type BranchFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
};

const initialState: ActionState = { ok: false };

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? (
    <p className="text-sm font-medium text-red-700" role="alert">
      {errors[0]}
    </p>
  ) : null;
}

export function BranchForm({ action }: BranchFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="surface grid max-w-3xl gap-4 p-6">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Branch name
        <input className="rounded-md border border-[var(--border)] px-3 py-2" name="name" required type="text" />
      </label>
      <FieldError errors={state.fieldErrors?.name} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Address line 1
          <input className="rounded-md border border-[var(--border)] px-3 py-2" name="addressLine1" type="text" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Address line 2
          <input className="rounded-md border border-[var(--border)] px-3 py-2" name="addressLine2" type="text" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          City
          <input className="rounded-md border border-[var(--border)] px-3 py-2" name="city" type="text" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Region
          <input className="rounded-md border border-[var(--border)] px-3 py-2" name="region" type="text" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Postal code
          <input className="rounded-md border border-[var(--border)] px-3 py-2" name="postalCode" type="text" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Country
          <input className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue="India" name="country" type="text" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          GSTIN
          <input className="rounded-md border border-[var(--border)] px-3 py-2" name="gstin" type="text" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Location hint
          <input className="rounded-md border border-[var(--border)] px-3 py-2" name="locationHint" type="text" />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Sales context
        <textarea className="min-h-24 rounded-md border border-[var(--border)] px-3 py-2" name="salesContext" />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Notes
        <textarea className="min-h-24 rounded-md border border-[var(--border)] px-3 py-2" name="notes" />
      </label>

      <div>
        <button className="rounded-md bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={pending} type="submit">
          {pending ? "Saving..." : "Create branch"}
        </button>
      </div>
    </form>
  );
}
