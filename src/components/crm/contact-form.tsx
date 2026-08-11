"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormDraft } from "@/components/forms/use-form-draft";
import type { ActionState } from "@/server/crm/types";

type ContactFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  branches: Array<{ id: string; name: string }>;
  initialValues?: { branchId: string | null; name: string; designation: string | null; email: string | null; phone: string | null; isPrimary: boolean; notes: string | null };
  submitLabel?: string;
  draftKey?: string;
};

const initialState: ActionState = { ok: false };

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? (
    <p className="text-sm font-medium text-red-700" role="alert">
      {errors[0]}
    </p>
  ) : null;
}

export function ContactForm({ action, branches, initialValues, submitLabel = "Create contact", draftKey = "contact" }: ContactFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const draft = useFormDraft(draftKey);
  useEffect(() => { if (draft.hasDraft && formRef.current) draft.restoreForm(formRef.current); }, [draft]);
  useEffect(() => { if (state.ok) draft.clear(); }, [state.ok, draft]);

  return (
    <form action={formAction} className="surface grid w-full max-w-3xl gap-4 p-4 sm:p-6" onChange={(event) => draft.saveForm(event.currentTarget)} ref={formRef}>
      {draft.hasDraft ? <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status">Unsaved contact draft restored. <button className="font-semibold underline" onClick={draft.clear} type="button">Discard draft</button></div> : null}
      <label className="flex flex-col gap-1 text-sm font-medium">
        Contact name
        <input className="crm-control" defaultValue={initialValues?.name ?? ""} name="name" required type="text" />
      </label>
      <FieldError errors={state.fieldErrors?.name} />

      <label className="flex flex-col gap-1 text-sm font-medium">
        Branch
        <select className="crm-control" defaultValue={initialValues?.branchId ?? ""} name="branchId">
          <option value="">Company level</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          Designation
          <input className="crm-control" defaultValue={initialValues?.designation ?? ""} name="designation" type="text" />
        </label>
        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          Email
          <input className="crm-control" defaultValue={initialValues?.email ?? ""} name="email" type="email" />
        </label>
        <label className="min-w-0 flex flex-col gap-1 text-sm font-medium">
          Phone
          <input className="crm-control" defaultValue={initialValues?.phone ?? ""} name="phone" type="tel" />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input className="h-4 w-4" defaultChecked={initialValues?.isPrimary} name="isPrimary" type="checkbox" />
        Primary contact
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Notes
        <textarea className="crm-control min-h-24" defaultValue={initialValues?.notes ?? ""} name="notes" />
      </label>

      <div className="crm-form-actions">
        <button className="crm-button crm-button-primary sm:w-auto" disabled={pending} type="submit">
          {pending ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
