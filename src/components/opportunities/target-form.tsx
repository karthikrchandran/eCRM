"use client";

import { useActionState } from "react";
import type { ActionState } from "@/server/opportunities/types";

type Owner = {
  id: string;
  name: string;
  email: string;
};

type Target = {
  id: string;
  financialYear: number;
  quarter: number;
  targetValueInr: unknown;
  owner: Owner;
};

type TargetFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  owners: Owner[];
  targets: Target[];
};

const initialState: ActionState = { ok: false };

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? (
    <p className="text-sm font-medium text-red-700" role="alert">
      {errors[0]}
    </p>
  ) : null;
}

function formatAmount(value: unknown) {
  if (value === null || value === undefined) {
    return "INR 0.00";
  }

  const amount = Number(value.toString());

  if (!Number.isFinite(amount)) {
    return "INR 0.00";
  }

  return `INR ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(amount)}`;
}

export function TargetForm({ action, owners, targets }: TargetFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const currentYear = new Date().getFullYear();

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <form action={formAction} className="surface grid gap-4 p-4">
        <h2 className="text-lg font-semibold">Sales target</h2>

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
        <FieldError errors={state.fieldErrors?.ownerId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Financial year
            <input className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue={currentYear} name="financialYear" type="number" />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Quarter
            <select className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue="1" name="quarter">
              <option value="1">Q1</option>
              <option value="2">Q2</option>
              <option value="3">Q3</option>
              <option value="4">Q4</option>
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Target value INR
          <input className="rounded-md border border-[var(--border)] px-3 py-2" min="0" name="targetValueInr" required step="0.01" type="number" />
        </label>
        <FieldError errors={state.fieldErrors?.targetValueInr} />

        {state.message ? <p className="text-sm text-[var(--muted)]">{state.message}</p> : null}

        <button className="rounded-md bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={pending} type="submit">
          {pending ? "Saving..." : "Save target"}
        </button>
      </form>

      <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Owner</th>
              <th className="px-4 py-3 font-semibold">Period</th>
              <th className="px-4 py-3 font-semibold">Target</th>
            </tr>
          </thead>
          <tbody>
            {targets.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-[var(--muted)]" colSpan={3}>
                  No targets configured.
                </td>
              </tr>
            ) : null}
            {targets.map((target) => (
              <tr className="border-t border-[var(--border)]" key={target.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">{target.owner.name}</p>
                  <p className="text-xs text-[var(--muted)]">{target.owner.email}</p>
                </td>
                <td className="px-4 py-3">
                  FY {target.financialYear} Q{target.quarter}
                </td>
                <td className="px-4 py-3 font-medium">{formatAmount(target.targetValueInr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
