"use client";

import { useActionState } from "react";
import type { ActionState } from "@/server/finance/types";

const initialState: ActionState = { ok: false };

export function CostComponentForm({
  action,
  currency,
  orderId,
  orderLineItems
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  currency: string;
  orderId: string;
  orderLineItems: Array<{ id: string; productNameSnapshot: string }>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <input name="orderId" type="hidden" value={orderId} />
      <p className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Enter real order costs in {currency}; approved costs reduce gross margin and incentive readiness.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Cost category
          <input className="crm-control" name="category" type="text" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Order line
          <select className="crm-control" name="orderLineItemId">
            <option value="">Order level</option>
            {orderLineItems.map((line) => (
              <option key={line.id} value={line.id}>
                {line.productNameSnapshot}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Cost amount ({currency})
          <input className="crm-control" min={0} name="amount" step="0.01" type="number" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Description
          <input className="crm-control" name="description" type="text" />
        </label>
      </div>
      {state.message ? <p className="text-sm text-[var(--muted)]">{state.message}</p> : null}
      <div>
        <button className="crm-button crm-button-primary" disabled={pending} type="submit">
          {pending ? "Saving..." : "Save cost"}
        </button>
      </div>
    </form>
  );
}
