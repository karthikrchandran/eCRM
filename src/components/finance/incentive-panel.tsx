"use client";

import { useActionState } from "react";
import type { ActionState } from "@/server/finance/types";

const initialState: ActionState = { ok: false };

export function IncentiveApprovalForm({
  action,
  disabled
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-3 grid gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Override payout paise
          <input className="crm-control" min={0} name="overrideAmountPaisa" type="number" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Override reason
          <input className="crm-control" name="overrideReason" type="text" />
        </label>
      </div>
      {state.fieldErrors?.overrideReason ? <p className="text-sm font-medium text-red-700">{state.fieldErrors.overrideReason[0]}</p> : null}
      {state.message ? <p className="text-sm text-[var(--muted)]">{state.message}</p> : null}
      <div>
        <button className="crm-button crm-button-primary" disabled={disabled || pending} type="submit">
          {pending ? "Approving..." : "Approve incentive"}
        </button>
      </div>
    </form>
  );
}
