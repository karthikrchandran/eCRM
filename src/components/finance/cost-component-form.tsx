"use client";

import { useActionState } from "react";
import type { ActionState } from "@/server/finance/types";

const initialState: ActionState = { ok: false };

export function CostComponentForm({
  action,
  orderId,
  orderLineItems
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  orderId: string;
  orderLineItems: Array<{ id: string; productNameSnapshot: string }>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <input name="orderId" type="hidden" value={orderId} />
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
          Cost amount paise
          <input className="crm-control" min={0} name="amountPaisa" type="number" />
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
