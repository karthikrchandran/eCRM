"use client";

import { useActionState } from "react";
import type { ActionState } from "@/server/finance/types";

const initialState: ActionState = { ok: false };

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? (
    <p className="text-sm font-medium text-red-700" role="alert">
      {errors[0]}
    </p>
  ) : null;
}

export function InvoiceForm({
  action,
  defaultGstPaisa,
  defaultSubtotalPaisa,
  orderId
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  defaultGstPaisa: number;
  defaultSubtotalPaisa: number;
  orderId: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <input name="orderId" type="hidden" value={orderId} />
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Invoice number
          <input className="crm-control" name="invoiceNumber" type="text" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Invoice date
          <input className="crm-control" name="invoiceDate" type="date" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Due date
          <input className="crm-control" name="dueDate" type="date" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Invoice subtotal paise
          <input className="crm-control" defaultValue={defaultSubtotalPaisa} min={1} name="subtotalPaisa" type="number" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          GST paise
          <input className="crm-control" defaultValue={defaultGstPaisa} min={0} name="gstPaisa" type="number" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Notes
          <input className="crm-control" name="notes" type="text" />
        </label>
      </div>
      <FieldError errors={state.fieldErrors?.invoiceNumber} />
      <FieldError errors={state.fieldErrors?.invoiceDate} />
      {state.message ? <p className="text-sm text-[var(--muted)]">{state.message}</p> : null}
      <div>
        <button className="crm-button crm-button-primary" disabled={pending} type="submit">
          {pending ? "Saving..." : "Save invoice"}
        </button>
      </div>
    </form>
  );
}
