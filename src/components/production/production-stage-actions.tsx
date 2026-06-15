"use client";

import { useActionState } from "react";
import type { ActionState } from "@/server/production/types";

type ProductionStageActionsProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  owners: Array<{ id: string; name: string; email: string }>;
};

const initialState: ActionState = { ok: false };

export function ProductionStageActions({ action, owners }: ProductionStageActionsProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-3 grid gap-2">
      <div className="flex flex-wrap gap-2">
        {["IN_PROGRESS", "BLOCKED", "DONE"].map((status) => (
          <button className="crm-button crm-button-secondary text-sm" disabled={pending} key={status} name="status" type="submit" value={status}>
            Mark {status.toLowerCase().replaceAll("_", " ")}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Note
        <input className="crm-control" name="noteBody" type="text" />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Assignee
          <select className="crm-control" name="assignedToId">
            <option value="">Unassigned</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name} - {owner.email}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Due date
          <input className="crm-control" name="dueAt" type="date" />
        </label>
      </div>
      {state.message ? <p className="text-sm text-[var(--muted)]">{state.message}</p> : null}
    </form>
  );
}
