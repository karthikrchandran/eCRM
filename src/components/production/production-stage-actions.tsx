"use client";

import type { ProductionStageStatus } from "@prisma/client";
import { useActionState } from "react";
import type { ActionState } from "@/server/production/types";

type ProductionStageActionsProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  compact?: boolean;
  owners: Array<{ id: string; name: string; email: string }>;
  status: ProductionStageStatus;
};

const initialState: ActionState = { ok: false };
const statuses: Array<{ label: string; value: ProductionStageStatus }> = [
  { label: "Not started", value: "NOT_STARTED" },
  { label: "In progress", value: "IN_PROGRESS" },
  { label: "Blocked", value: "BLOCKED" },
  { label: "Done", value: "DONE" },
  { label: "Skipped", value: "SKIPPED" }
];

export function ProductionStageActions({ action, compact = false, owners, status }: ProductionStageActionsProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={compact ? "grid gap-2" : "mt-3 grid gap-2"}>
      <div className={compact ? "grid gap-2 md:grid-cols-[minmax(10rem,1fr)_auto] md:items-end" : "grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"}>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Change status
          <select className="crm-control" defaultValue={status} name="status">
            {statuses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button className="crm-button crm-button-primary text-sm" disabled={pending} type="submit">
          Update status
        </button>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Note
        <input className="crm-control" name="noteBody" type="text" />
      </label>
      <div className={compact ? "grid gap-2 lg:grid-cols-2" : "grid gap-2 sm:grid-cols-2"}>
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
      <label className="flex flex-col gap-1 text-sm font-medium">
        Skipped reason
        <input className="crm-control" name="skippedReason" placeholder="Required only when status is skipped" type="text" />
      </label>
      {state.message ? <p className="text-sm text-[var(--muted)]">{state.message}</p> : null}
    </form>
  );
}
