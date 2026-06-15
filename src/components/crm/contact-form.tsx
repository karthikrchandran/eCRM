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
    <form action={formAction} className="surface grid max-w-3xl gap-4 p-6">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Contact name
        <input className="rounded-md border border-[var(--border)] px-3 py-2" name="name" required type="text" />
      </label>
      <FieldError errors={state.fieldErrors?.name} />

      <label className="flex flex-col gap-1 text-sm font-medium">
        Branch
        <select className="rounded-md border border-[var(--border)] px-3 py-2" name="branchId">
          <option value="">Company level</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Designation
          <input className="rounded-md border border-[var(--border)] px-3 py-2" name="designation" type="text" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input className="rounded-md border border-[var(--border)] px-3 py-2" name="email" type="email" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Phone
          <input className="rounded-md border border-[var(--border)] px-3 py-2" name="phone" type="tel" />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input className="h-4 w-4" name="isPrimary" type="checkbox" />
        Primary contact
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Notes
        <textarea className="min-h-24 rounded-md border border-[var(--border)] px-3 py-2" name="notes" />
      </label>

      <div>
        <button className="rounded-md bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={pending} type="submit">
          {pending ? "Saving..." : "Create contact"}
        </button>
      </div>
    </form>
  );
}
