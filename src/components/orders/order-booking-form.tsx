"use client";

import { useActionState } from "react";
import type { ActionState } from "@/server/orders/types";

type OrderBookingFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  proposalId: string;
};

const initialState: ActionState = { ok: false };

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? (
    <p className="text-sm font-medium text-red-700" role="alert">
      {errors[0]}
    </p>
  ) : null;
}

export function OrderBookingForm({ action, proposalId }: OrderBookingFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="surface grid max-w-3xl gap-4 p-4">
      <input name="proposalId" type="hidden" value={proposalId} />
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          PO number
          <input className="crm-control" name="poNumber" type="text" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          PO date
          <input className="crm-control" name="poDate" type="date" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Delivery due date
          <input className="crm-control" name="deliveryDueAt" type="date" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          PO file name
          <input className="crm-control" name="poFileName" type="text" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          PO storage key
          <input className="crm-control" name="poStorageKey" type="text" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          PO MIME type
          <input className="crm-control" defaultValue="application/pdf" name="poMimeType" type="text" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          PO file size bytes
          <input className="crm-control" min={1} name="poFileSizeBytes" type="number" />
        </label>
      </div>
      <FieldError errors={state.fieldErrors?.proposalId} />
      <FieldError errors={state.fieldErrors?.poFileSizeBytes} />
      {state.message ? <p className="text-sm text-[var(--muted)]">{state.message}</p> : null}
      <div>
        <button className="crm-button crm-button-primary" disabled={pending} type="submit">
          {pending ? "Booking..." : "Book order"}
        </button>
      </div>
    </form>
  );
}
