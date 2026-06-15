"use client";

import { useActionState } from "react";
import type { ProductServiceRecord } from "@/server/products/queries";
import { ProposalLineItems } from "./proposal-line-items";

type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

type ProposalFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  opportunityId: string;
  products: ProductServiceRecord[];
  submitLabel: string;
};

const initialState: ActionState = { ok: false };

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? (
    <p className="text-sm font-medium text-red-700" role="alert">
      {errors[0]}
    </p>
  ) : null;
}

export function ProposalForm({ action, opportunityId, products, submitLabel }: ProposalFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="surface grid max-w-6xl gap-4 p-6">
      <input name="opportunityId" type="hidden" value={opportunityId} />

      <div className="grid gap-4 md:grid-cols-[1fr_180px_180px]">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Proposal title
          <input className="rounded-md border border-[var(--border)] px-3 py-2" name="title" required type="text" />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Version label
          <input className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue="V1" name="versionLabel" type="text" />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Valid until
          <input className="rounded-md border border-[var(--border)] px-3 py-2" name="validUntil" type="date" />
        </label>
      </div>
      <FieldError errors={state.fieldErrors?.title} />
      <FieldError errors={state.fieldErrors?.validUntil} />

      <label className="flex flex-col gap-1 text-sm font-medium">
        Commercial summary
        <textarea className="min-h-28 rounded-md border border-[var(--border)] px-3 py-2" name="commercialSummary" />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Assumptions
          <textarea className="min-h-24 rounded-md border border-[var(--border)] px-3 py-2" name="assumptions" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Inclusions
          <textarea className="min-h-24 rounded-md border border-[var(--border)] px-3 py-2" name="inclusions" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Exclusions
          <textarea className="min-h-24 rounded-md border border-[var(--border)] px-3 py-2" name="exclusions" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Payment terms
          <textarea className="min-h-24 rounded-md border border-[var(--border)] px-3 py-2" name="paymentTerms" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Delivery timeline
          <textarea className="min-h-24 rounded-md border border-[var(--border)] px-3 py-2" name="deliveryTimeline" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Internal notes
          <textarea className="min-h-24 rounded-md border border-[var(--border)] px-3 py-2" name="internalNotes" />
        </label>
      </div>

      <ProposalLineItems products={products} />
      <FieldError errors={state.fieldErrors?.opportunityId} />

      {state.message ? <p className="text-sm text-[var(--muted)]">{state.message}</p> : null}

      <div>
        <button
          className="rounded-md bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-60"
          disabled={pending || products.length === 0}
          type="submit"
        >
          {pending ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
