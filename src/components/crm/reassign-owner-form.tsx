"use client";

import { useActionState } from "react";
import type { ActionState } from "@/server/crm/types";

type ReassignOwnerFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  owners: Array<{ id: string; name: string; email: string }>;
};

const initialState: ActionState = { ok: false };

export function ReassignOwnerForm({ action, owners }: ReassignOwnerFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="surface grid gap-4 p-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        New owner
        <select className="rounded-md border border-[var(--border)] px-3 py-2" name="toOwnerId" required>
          <option value="">Choose owner</option>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.name} ({owner.email})
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Reassignment reason
        <textarea className="min-h-24 rounded-md border border-[var(--border)] px-3 py-2" name="reason" required />
      </label>

      {state.fieldErrors?.reason?.[0] ? (
        <p className="text-sm font-medium text-red-700" role="alert">
          {state.fieldErrors.reason[0]}
        </p>
      ) : null}
      {state.message ? <p className="text-sm text-[var(--muted)]">{state.message}</p> : null}

      <div>
        <button className="rounded-md bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={pending} type="submit">
          {pending ? "Saving..." : "Reassign owner"}
        </button>
      </div>
    </form>
  );
}
