"use client";

import { useActionState } from "react";
import { PageHeader } from "@/components/ui/sales-primitives";
import type { ProductServiceRecord } from "@/server/products/queries";
import { ProposalLineItems } from "./proposal-line-items";

type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

type ProposalFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  currency: "INR" | "USD";
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

export function ProposalForm({ action, currency, opportunityId, products, submitLabel }: ProposalFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid max-w-6xl gap-5">
      <input name="opportunityId" type="hidden" value={opportunityId} />
      <PageHeader
        eyebrow="Commercial proposal"
        title="Create proposal"
        description={`Capture commercial terms, line items, and delivery assumptions before sending a proposal document link. Currency: ${currency}.`}
      />
      <section className="surface grid gap-4 p-4 sm:p-6">
        <div className="grid gap-4 md:grid-cols-[1fr_180px_180px]">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Proposal title
            <input className="crm-control" name="title" required type="text" />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Version label
            <input className="crm-control" defaultValue="V1" name="versionLabel" type="text" />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Valid until
            <input className="crm-control" name="validUntil" type="date" />
          </label>
        </div>
        <FieldError errors={state.fieldErrors?.title} />
        <FieldError errors={state.fieldErrors?.validUntil} />

        <label className="flex flex-col gap-1 text-sm font-medium">
          Commercial summary
          <textarea className="crm-control min-h-28" name="commercialSummary" />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Assumptions
            <textarea className="crm-control min-h-24" name="assumptions" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Inclusions
            <textarea className="crm-control min-h-24" name="inclusions" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Exclusions
            <textarea className="crm-control min-h-24" name="exclusions" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Payment terms
            <textarea className="crm-control min-h-24" name="paymentTerms" />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Delivery timeline
            <textarea className="crm-control min-h-24" name="deliveryTimeline" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Internal notes
            <textarea className="crm-control min-h-24" name="internalNotes" />
          </label>
        </div>
      </section>

      <ProposalLineItems currency={currency} products={products} />
      <FieldError errors={state.fieldErrors?.opportunityId} />

      {state.message ? <p className="text-sm text-[var(--muted)]">{state.message}</p> : null}

      <div>
        <button
          className="crm-button crm-button-primary disabled:opacity-60"
          disabled={pending || products.length === 0}
          type="submit"
        >
          {pending ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
