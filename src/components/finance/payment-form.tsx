"use client";

import { useActionState } from "react";
import type { ActionState } from "@/server/finance/types";

const initialState: ActionState = { ok: false };

function formatAmount(value: number, currency: string) {
  const locale = currency === "USD" ? "en-US" : "en-IN";
  return `${currency} ${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(value / 100)}`;
}

export function PaymentForm({
  action,
  currency,
  invoices,
  orderId
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  currency: string;
  invoices: Array<{ id: string; invoiceNumber: string; totalPaisa: number }>;
  orderId: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <input name="orderId" type="hidden" value={orderId} />
      <p className="rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800">
        Allocate the payment to one invoice for now. Enter the amount in {currency}.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Invoice
          <select className="crm-control" name="invoiceId">
            {invoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.invoiceNumber} - {formatAmount(invoice.totalPaisa, currency)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Payment date
          <input className="crm-control" name="paymentDate" type="date" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Payment amount ({currency})
          <input className="crm-control" min={0.01} name="amount" step="0.01" type="number" />
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
