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
    <form action={formAction} className="surface grid w-full max-w-3xl gap-4 p-4 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          Type
          <select className="crm-control" defaultValue="CALL" name="type">
            <option value="CALL">CALL</option>
            <option value="EMAIL">EMAIL</option>
            <option value="MEETING">MEETING</option>
            <option value="NOTE">NOTE</option>
            <option value="FOLLOW_UP">FOLLOW_UP</option>
          </select>
        </label>

        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          Status
          <select className="crm-control" defaultValue="OPEN" name="status">
            <option value="OPEN">OPEN</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </label>

        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          Owner
          <select className="crm-control" name="ownerId" required>
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

        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          Contact
          <select className="crm-control" name="contactId">
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
        <input className="crm-control" name="subject" required type="text" />
      </label>
      <FieldError errors={state.fieldErrors?.subject} />

      <label className="flex flex-col gap-1 text-sm font-medium">
        Body
        <textarea className="crm-control min-h-28" name="body" />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          Occurred date
          <input className="crm-control" name="occurredAt" type="datetime-local" />
        </label>
        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          Due date
          <input className="crm-control" name="dueAt" type="datetime-local" />
        </label>
      </div>
      <FieldError errors={state.fieldErrors?.dueAt} />

      <div className="crm-form-actions">
        <button className="crm-button crm-button-primary sm:w-auto" disabled={pending} type="submit">
          {pending ? "Saving..." : "Add activity"}
        </button>
      </div>
    </form>
  );
}
