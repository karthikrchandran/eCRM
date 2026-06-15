"use client";

import { useActionState } from "react";
import type { ActionState } from "@/server/crm/types";

type ActivityFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  owners: Array<{ id: string; name: string; email: string }>;
  branches: Array<{ id: string; name: string }>;
  contacts: Array<{ id: string; name: string }>;
};

const initialState: ActionState = { ok: false };

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? (
    <p className="text-sm font-medium text-red-700" role="alert">
      {errors[0]}
    </p>
  ) : null;
}

export function ActivityForm({ action, owners, branches, contacts }: ActivityFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="surface grid max-w-3xl gap-4 p-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Type
          <select className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue="CALL" name="type">
            <option value="CALL">CALL</option>
            <option value="EMAIL">EMAIL</option>
            <option value="MEETING">MEETING</option>
            <option value="NOTE">NOTE</option>
            <option value="FOLLOW_UP">FOLLOW_UP</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Status
          <select className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue="OPEN" name="status">
            <option value="OPEN">OPEN</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Owner
          <select className="rounded-md border border-[var(--border)] px-3 py-2" name="ownerId" required>
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

        <label className="flex flex-col gap-1 text-sm font-medium">
          Contact
          <select className="rounded-md border border-[var(--border)] px-3 py-2" name="contactId">
            <option value="">No contact</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Subject
        <input className="rounded-md border border-[var(--border)] px-3 py-2" name="subject" required type="text" />
      </label>
      <FieldError errors={state.fieldErrors?.subject} />

      <label className="flex flex-col gap-1 text-sm font-medium">
        Body
        <textarea className="min-h-28 rounded-md border border-[var(--border)] px-3 py-2" name="body" />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Occurred date
          <input className="rounded-md border border-[var(--border)] px-3 py-2" name="occurredAt" type="datetime-local" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Due date
          <input className="rounded-md border border-[var(--border)] px-3 py-2" name="dueAt" type="datetime-local" />
        </label>
      </div>
      <FieldError errors={state.fieldErrors?.dueAt} />

      <div>
        <button className="rounded-md bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={pending} type="submit">
          {pending ? "Saving..." : "Add activity"}
        </button>
      </div>
    </form>
  );
}
