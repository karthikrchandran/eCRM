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
    <form action={formAction} className="mt-4 grid gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-4">
      <h3 className="font-semibold">Add proposal document link</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Document name
          <input className="crm-control" name="originalFileName" placeholder="Final proposal PDF" required type="text" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Document URL
          <input className="crm-control" name="documentUrl" placeholder="https://..." required type="url" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Document source
          <select className="crm-control" defaultValue="external" name="storageProvider">
            <option value="external">External link</option>
            <option value="sharepoint">SharePoint</option>
            <option value="onedrive">OneDrive</option>
            <option value="google_drive">Google Drive</option>
            <option value="local_link">Local/intranet link</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Canva/design URL
          <input className="crm-control" name="canvaDesignUrl" type="url" />
        </label>
      </div>
      <FieldError errors={state.fieldErrors?.originalFileName} />
      <FieldError errors={state.fieldErrors?.documentUrl} />
      <FieldError errors={state.fieldErrors?.canvaDesignUrl} />
      {state.message ? <p className="text-sm text-[var(--muted)]">{state.message}</p> : null}
      <div>
        <button className="crm-button crm-button-primary" disabled={pending} type="submit">
          {pending ? "Saving..." : "Save document link"}
        </button>
      </div>
    </form>
  );
}
