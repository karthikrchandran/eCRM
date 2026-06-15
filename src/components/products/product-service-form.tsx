"use client";

import { useActionState } from "react";
import type { ActionState } from "@/server/products/types";

type ProductServiceInitialValues = {
  id?: string;
  name: string;
  code?: string | null;
  category: string;
  description?: string | null;
  defaultGstRateBps: number;
  defaultProductionTemplateKey?: string | null;
  active: boolean;
  sortOrder: number;
};

type ProductServiceFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initialState?: ActionState;
  initialValues?: ProductServiceInitialValues;
  submitLabel: string;
};

const defaultState: ActionState = { ok: false };

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) {
    return null;
  }

  return (
    <p className="text-sm font-medium text-red-700" role="alert">
      {errors[0]}
    </p>
  );
}

export function ProductServiceForm({ action, initialState = defaultState, initialValues, submitLabel }: ProductServiceFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="surface grid w-full max-w-3xl gap-4 p-4 sm:p-6">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Name
        <input className="crm-control" defaultValue={initialValues?.name ?? ""} name="name" required type="text" />
      </label>
      <FieldError errors={state.fieldErrors?.name} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          Code
          <input className="crm-control" defaultValue={initialValues?.code ?? ""} name="code" type="text" />
        </label>

        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          Category
          <input className="crm-control" defaultValue={initialValues?.category ?? ""} name="category" required type="text" />
        </label>
      </div>
      <FieldError errors={state.fieldErrors?.category} />

      <label className="flex flex-col gap-1 text-sm font-medium">
        Description
        <textarea className="crm-control min-h-28" defaultValue={initialValues?.description ?? ""} name="description" />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          GST basis points
          <input
            className="crm-control"
            defaultValue={initialValues?.defaultGstRateBps ?? 1800}
            max={2800}
            min={0}
            name="defaultGstRateBps"
            required
            type="number"
          />
        </label>

        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          Production template key
          <input
            className="crm-control"
            defaultValue={initialValues?.defaultProductionTemplateKey ?? ""}
            name="defaultProductionTemplateKey"
            type="text"
          />
        </label>
      </div>
      <FieldError errors={state.fieldErrors?.defaultGstRateBps} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input className="h-4 w-4" defaultChecked={initialValues?.active ?? true} name="active" type="checkbox" />
          Active
        </label>

        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          Sort order
          <input className="crm-control" defaultValue={initialValues?.sortOrder ?? 0} min={0} name="sortOrder" required type="number" />
        </label>
      </div>
      <FieldError errors={state.fieldErrors?.sortOrder} />

      {state.message ? <p className="text-sm text-[var(--muted)]">{state.message}</p> : null}

      <div className="crm-form-actions">
        <button className="crm-button crm-button-primary sm:w-auto" disabled={pending} type="submit">
          {pending ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
