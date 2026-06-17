"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { LeadImportActionState } from "@/server/crm/lead-import-actions";

type LeadImportFormProps = {
  action: (state: LeadImportActionState, formData: FormData) => Promise<LeadImportActionState>;
};

const initialState: LeadImportActionState = { ok: false, errors: [] };

export function LeadImportForm({ action }: LeadImportFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="space-y-6">
      <form action={formAction} className="surface grid max-w-4xl gap-4 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
            Lead CSV file
            <input
              accept=".csv,text/csv"
              className="rounded-md border border-[var(--border)] px-3 py-2"
              name="csvFile"
              required
              type="file"
            />
          </label>
          <Link className="rounded-md border border-[var(--border)] px-4 py-2 text-center text-sm font-semibold" href="/leads/import/template">
            Download template
          </Link>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-60"
            disabled={pending}
            name="intent"
            type="submit"
            value="preview"
          >
            {pending ? "Checking..." : "Preview CSV"}
          </button>
          <button
            className="crm-button crm-button-primary text-sm"
            disabled={pending}
            name="intent"
            type="submit"
            value="import"
          >
            {pending ? "Importing..." : "Import CSV"}
          </button>
        </div>
      </form>

      {state.message ? (
        <p className={`text-sm font-medium ${state.ok ? "text-[var(--status-positive-text)]" : "text-red-700"}`} role="status">
          {state.message}
        </p>
      ) : null}

      {state.errors?.length ? (
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Row</th>
                <th className="px-4 py-3 font-semibold">Field</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody>
              {state.errors.map((error, index) => (
                <tr className="border-t border-[var(--border)]" key={`${error.rowNumber}-${error.field}-${index}`}>
                  <td className="px-4 py-3 align-top">{error.rowNumber || "File"}</td>
                  <td className="px-4 py-3 align-top font-medium">{error.field}</td>
                  <td className="px-4 py-3 align-top text-[var(--muted)]">{error.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {state.rows?.length ? (
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Row</th>
                <th className="px-4 py-3 font-semibold">Lead/customer</th>
                <th className="px-4 py-3 font-semibold">Owner</th>
                <th className="px-4 py-3 font-semibold">Branch</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
              </tr>
            </thead>
            <tbody>
              {state.rows.map((row) => (
                <tr className="border-t border-[var(--border)]" key={row.rowNumber}>
                  <td className="px-4 py-3 align-top">{row.rowNumber}</td>
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium">{row.lead.name}</p>
                    <p className="text-xs text-[var(--muted)]">{row.lead.state}</p>
                  </td>
                  <td className="px-4 py-3 align-top text-[var(--muted)]">{row.ownerEmail}</td>
                  <td className="px-4 py-3 align-top text-[var(--muted)]">{row.branch?.name ?? "None"}</td>
                  <td className="px-4 py-3 align-top text-[var(--muted)]">{row.contact?.name ?? "None"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
