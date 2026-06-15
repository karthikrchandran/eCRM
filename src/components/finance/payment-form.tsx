"use client";

import { useActionState } from "react";
import type { ActionState } from "@/server/finance/types";

const initialState: ActionState = { ok: false };

export function PaymentForm({
  action,
  invoices,
  orderId
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  invoices: Array<{ id: string; invoiceNumber: string; totalPaisa: number }>;
  orderId: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <input name="orderId" type="hidden" value={orderId} />
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Invoice
          <select className="crm-control" name="invoiceId">
            {invoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.invoiceNumber}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Payment date
          <input className="crm-control" name="paymentDate" type="date" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Payment amount paise
          <input className="crm-control" min={1} name="amountPaisa" type="number" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Mode
          <select className="crm-control" name="mode">
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="UPI">UPI</option>
            <option value="CHEQUE">Cheque</option>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Reference
          <input className="crm-control" name="reference" type="text" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Notes
          <input className="crm-control" name="notes" type="text" />
        </label>
      </div>
      {state.fieldErrors?.allocations ? <p className="text-sm font-medium text-red-700">{state.fieldErrors.allocations[0]}</p> : null}
      {state.message ? <p className="text-sm text-[var(--muted)]">{state.message}</p> : null}
      <div>
        <button className="crm-button crm-button-primary" disabled={pending || invoices.length === 0} type="submit">
          {pending ? "Recording..." : "Record payment"}
        </button>
      </div>
    </form>
  );
}
