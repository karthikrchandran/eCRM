"use client";

import { useActionState } from "react";
import type { ActionState } from "@/server/opportunities/types";

type Stage = {
  id: string;
  name: string;
  sortOrder: number;
  kind: "OPEN" | "WON" | "LOST" | "DORMANT";
  active: boolean;
};

type StageFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  canManage: boolean;
  stages: Stage[];
};

const initialState: ActionState = { ok: false };

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? (
    <p className="text-sm font-medium text-red-700" role="alert">
      {errors[0]}
    </p>
  ) : null;
}

export function StageForm({ action, canManage, stages }: StageFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <section className="surface p-4">
        <h2 className="text-lg font-semibold">Stage setup</h2>
        {canManage ? (
          <form action={formAction} className="mt-4 grid gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Stage name
              <input className="rounded-md border border-[var(--border)] px-3 py-2" name="name" required type="text" />
            </label>
            <FieldError errors={state.fieldErrors?.name} />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Sort order
                <input className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue="10" min="0" name="sortOrder" type="number" />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Kind
                <select className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue="OPEN" name="kind">
                  <option value="OPEN">OPEN</option>
                  <option value="WON">WON</option>
                  <option value="LOST">LOST</option>
                  <option value="DORMANT">DORMANT</option>
                </select>
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium">
              <input defaultChecked name="active" type="checkbox" />
              Active
            </label>

            {state.message ? <p className="text-sm text-[var(--muted)]">{state.message}</p> : null}

            <button className="rounded-md bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={pending} type="submit">
              {pending ? "Saving..." : "Save stage"}
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">Only Admin can manage pipeline stages.</p>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Stage</th>
              <th className="px-4 py-3 font-semibold">Kind</th>
              <th className="px-4 py-3 font-semibold">Sort</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage) => (
              <tr className="border-t border-[var(--border)]" key={stage.id}>
                <td className="px-4 py-3 font-medium">{stage.name}</td>
                <td className="px-4 py-3">{stage.kind}</td>
                <td className="px-4 py-3">{stage.sortOrder}</td>
                <td className="px-4 py-3">{stage.active ? "Active" : "Inactive"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
