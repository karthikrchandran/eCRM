"use client";

import { useActionState } from "react";
import { updateBusinessSettingsAction } from "@/server/settings/actions";
import type { BusinessSettingsView } from "@/server/settings/settings";

type SettingsActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

const initialState: SettingsActionState = { ok: false };

export function BusinessSettingsForm({ settings }: { settings: BusinessSettingsView }) {
  const [state, formAction, pending] = useActionState(updateBusinessSettingsAction, initialState);

  return (
    <form action={formAction} className="surface grid max-w-3xl gap-5 p-4 sm:p-6">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Default currency
        <select className="crm-control" defaultValue={settings.defaultCurrency} name="defaultCurrency">
          <option value="INR">INR - Indian rupee</option>
          <option value="USD">USD - US dollar</option>
        </select>
      </label>
      {state.fieldErrors?.defaultCurrency?.length ? (
        <p className="text-sm font-medium text-red-700" role="alert">
          {state.fieldErrors.defaultCurrency[0]}
        </p>
      ) : null}

      <div className="rounded-md border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        <p className="font-semibold">USD tax handling</p>
        <p className="mt-1">When USD is selected, proposal lines use manual tax amount entry instead of automatic GST calculations.</p>
      </div>

      {state.message ? (
        <p className={`text-sm font-medium ${state.ok ? "text-[var(--status-positive-text)]" : "text-red-700"}`}>{state.message}</p>
      ) : null}

      <div className="crm-form-actions">
        <button className="crm-button crm-button-primary" disabled={pending} type="submit">
          {pending ? "Saving..." : "Save settings"}
        </button>
      </div>
    </form>
  );
}
