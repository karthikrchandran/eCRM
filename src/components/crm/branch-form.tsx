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
    <form action={formAction} className="surface grid w-full max-w-3xl gap-4 p-4 sm:p-6">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Branch name
        <input className="crm-control" name="name" required type="text" />
      </label>
      <FieldError errors={state.fieldErrors?.name} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          Address line 1
          <input className="crm-control" name="addressLine1" type="text" />
        </label>
        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          Address line 2
          <input className="crm-control" name="addressLine2" type="text" />
        </label>
        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          City
          <input className="crm-control" name="city" type="text" />
        </label>
        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          Region
          <input className="crm-control" name="region" type="text" />
        </label>
        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          Postal code
          <input className="crm-control" name="postalCode" type="text" />
        </label>
        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          Country
          <input className="crm-control" defaultValue="India" name="country" type="text" />
        </label>
        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          GSTIN
          <input className="crm-control" name="gstin" type="text" />
        </label>
        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          Location hint
          <input className="crm-control" name="locationHint" type="text" />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Sales context
        <textarea className="crm-control min-h-24" name="salesContext" />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Notes
        <textarea className="crm-control min-h-24" name="notes" />
      </label>

      <div className="crm-form-actions">
        <button className="crm-button crm-button-primary sm:w-auto" disabled={pending} type="submit">
          {pending ? "Saving..." : "Create branch"}
        </button>
      </div>
    </form>
  );
}
