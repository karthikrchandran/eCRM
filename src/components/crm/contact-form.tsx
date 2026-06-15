"use client";

import { useActionState } from "react";
import type { ActionState } from "@/server/crm/types";

type ContactFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  branches: Array<{ id: string; name: string }>;
};

const initialState: ActionState = { ok: false };

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? (
    <p className="text-sm font-medium text-red-700" role="alert">
      {errors[0]}
    </p>
  ) : null;
}

export function ContactForm({ action, branches }: ContactFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="surface grid w-full max-w-3xl gap-4 p-4 sm:p-6">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Contact name
        <input className="crm-control" name="name" required type="text" />
      </label>
      <FieldError errors={state.fieldErrors?.name} />

      <label className="flex flex-col gap-1 text-sm font-medium">
        Branch
        <select className="crm-control" name="branchId">
          <option value="">Company level</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          Designation
          <input className="crm-control" name="designation" type="text" />
        </label>
        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          Email
          <input className="crm-control" name="email" type="email" />
        </label>
        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          Phone
          <input className="crm-control" name="phone" type="tel" />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input className="h-4 w-4" name="isPrimary" type="checkbox" />
        Primary contact
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Notes
        <textarea className="crm-control min-h-24" name="notes" />
      </label>

      <div className="crm-form-actions">
        <button className="crm-button crm-button-primary sm:w-auto" disabled={pending} type="submit">
          {pending ? "Saving..." : "Create contact"}
        </button>
      </div>
    </form>
  );
}
