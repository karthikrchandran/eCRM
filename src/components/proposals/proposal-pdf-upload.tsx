"use client";

import { useActionState } from "react";

type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

type ProposalPdfUploadProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
};

const initialState: ActionState = { ok: false };

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? (
    <p className="text-sm font-medium text-red-700" role="alert">
      {errors[0]}
    </p>
  ) : null;
}

export function ProposalPdfUpload({ action }: ProposalPdfUploadProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-4 grid gap-3 rounded-md border border-[var(--border)] p-3">
      <h3 className="font-semibold">Add PDF metadata</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Original file name
          <input className="crm-control" name="originalFileName" required type="text" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Stored file name
          <input className="crm-control" name="storedFileName" required type="text" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Storage provider
          <input className="crm-control" defaultValue="local" name="storageProvider" required type="text" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Storage key
          <input className="crm-control" name="storageKey" required type="text" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          MIME type
          <input className="crm-control" defaultValue="application/pdf" name="mimeType" required type="text" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          File size bytes
          <input className="crm-control" min={1} name="fileSizeBytes" required type="number" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          SHA-256
          <input className="crm-control" name="sha256" type="text" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Canva design URL
          <input className="crm-control" name="canvaDesignUrl" type="url" />
        </label>
      </div>
      <FieldError errors={state.fieldErrors?.originalFileName} />
      <FieldError errors={state.fieldErrors?.storageKey} />
      <FieldError errors={state.fieldErrors?.mimeType} />
      <FieldError errors={state.fieldErrors?.fileSizeBytes} />
      {state.message ? <p className="text-sm text-[var(--muted)]">{state.message}</p> : null}
      <div>
        <button className="crm-button crm-button-secondary" disabled={pending} type="submit">
          {pending ? "Saving..." : "Save PDF metadata"}
        </button>
      </div>
    </form>
  );
}
