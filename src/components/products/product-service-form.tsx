"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ProductStageOption, ProductStageSelection } from "@/server/products/queries";
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
  selectedStages?: ProductStageSelection[];
  stageOptions?: ProductStageOption[];
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

export function ProductServiceForm({
  action,
  initialState = defaultState,
  initialValues,
  selectedStages = [],
  stageOptions = [],
  submitLabel
}: ProductServiceFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const selectedSortOrderByStageId = new Map(selectedStages.map((stage) => [stage.stageId, stage.sortOrder]));

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

        <div />
      </div>
      <FieldError errors={state.fieldErrors?.defaultGstRateBps} />

      <section className="rounded-md border border-[var(--border)] p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Production stages</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Choose the stages this product needs and set their order.</p>
          </div>
          <Link className="crm-button crm-button-secondary text-sm" href="/admin/production-config">
            Stage library
          </Link>
        </div>

        {stageOptions.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">No stages are defined yet. Add stages in the stage library first.</p>
        ) : (
          <div className="mt-4">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2 font-semibold">Use</th>
                  <th className="px-3 py-2 font-semibold">Stage</th>
                  <th className="px-3 py-2 font-semibold">Order</th>
                  <th className="px-3 py-2 font-semibold">Default duration</th>
                </tr>
              </thead>
              <tbody>
                {stageOptions.map((stage, index) => {
                  const selectedSortOrder = selectedSortOrderByStageId.get(stage.id);
                  return (
                    <tr className="border-t border-[var(--border)]" key={stage.id}>
                      <td className="px-3 py-3 align-top">
                        <input
                          defaultChecked={selectedSortOrder !== undefined}
                          name="productionStageIds"
                          type="checkbox"
                          value={stage.id}
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p className="font-medium">{stage.name}</p>
                        {stage.description ? <p className="mt-1 text-xs text-[var(--muted)]">{stage.description}</p> : null}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <input
                          className="crm-control w-24"
                          defaultValue={selectedSortOrder ?? (index + 1) * 10}
                          min={0}
                          name={`productionStageSortOrder:${stage.id}`}
                          type="number"
                        />
                      </td>
                      <td className="px-3 py-3 align-top text-[var(--muted)]">
                        {stage.defaultDurationDays ? `${stage.defaultDurationDays} days` : "None"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
