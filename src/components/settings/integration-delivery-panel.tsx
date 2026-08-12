"use client";

import { useState } from "react";

type CredentialView = {
  id: string; name: string; status: string; capabilities: string[]; expiresAt: string; lastUsedAt: string | null;
};
type StatusView = {
  pending: number; failed: number; deadLetter: number; delivered: number; checkpoint: string | null; sourceCount: number; degraded: boolean;
};

export function IntegrationDeliveryPanel({ credentials: initialCredentials, status, deadLetters, repairCandidates }: {
  credentials: CredentialView[];
  status: StatusView;
  deadLetters: Array<{ id: string; attempts: number; errorCode: string | null }>;
  repairCandidates: Array<{ id: string; status: string; sourceCount: number; destinationCount: number }>;
}) {
  const [credentials, setCredentials] = useState(initialCredentials);
  const [oneTimeSecret, setOneTimeSecret] = useState<string>();
  const [message, setMessage] = useState<string>();

  async function issueCredential(formData: FormData) {
    const response = await fetch("/api/admin/integrations", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        action: "issue", name: formData.get("name"),
        capabilities: formData.getAll("capabilities"),
        expiresAt: formData.get("expiresAt"), correlationId: crypto.randomUUID(), reason: "Customer administrator issued integration credential"
      })
    });
    const body = await response.json();
    if (response.ok) {
      setCredentials((current) => [{ ...body.credential, expiresAt: new Date(body.credential.expiresAt).toISOString(), lastUsedAt: null }, ...current]);
      setOneTimeSecret(body.secret);
    }
    setMessage(response.ok ? "Credential issued. Copy the secret now; it will not be shown again." : body.error ?? "Unable to issue credential.");
  }

  async function credentialAction(credentialId: string, action: "rotate" | "revoke") {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);
    const response = await fetch("/api/admin/integrations", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        action, credentialId, expiresAt: action === "rotate" ? expiresAt.toISOString() : undefined,
        correlationId: crypto.randomUUID(), reason: `Customer administrator requested credential ${action}`
      })
    });
    const body = response.status === 204 ? {} : await response.json();
    if (response.ok && action === "rotate") {
      setCredentials((current) => [body.credential, ...current.map((item) => item.id === credentialId ? { ...item, status: "ROTATED" } : item)]);
      setOneTimeSecret(body.secret);
    } else if (response.ok) {
      setCredentials((current) => current.map((item) => item.id === credentialId ? { ...item, status: "REVOKED" } : item));
    }
    setMessage(response.ok ? `Credential ${action} completed.` : body.error ?? `Unable to ${action} credential.`);
  }

  async function replay(id: string) {
    const reason = window.prompt("Reason for replay");
    if (!reason?.trim()) return;
    const response = await fetch("/api/admin/integrations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "replay", outboxId: id, reason }) });
    setMessage(response.ok ? "Dead letter queued for replay." : "Unable to replay dead letter.");
  }

  return <section className="surface grid gap-5 p-4 sm:p-6">
    <div>
      <h2 className="text-lg font-semibold">Integration delivery</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{status.degraded ? "Degraded - operator attention required" : "Healthy"} · {status.pending} pending · {status.failed} retrying · {status.deadLetter} dead letter · {status.delivered} delivered</p>
      <p className="text-sm text-[var(--muted)]">Source records: {status.sourceCount} · Destination checkpoint: {status.checkpoint ?? "Not established"}</p>
    </div>
    {oneTimeSecret ? <div className="rounded-md border border-amber-500 bg-amber-50 p-3 text-sm text-slate-950" role="alert"><strong>Copy this secret now:</strong> <code>{oneTimeSecret}</code><button className="ml-3 underline" onClick={() => setOneTimeSecret(undefined)} type="button">Hide</button></div> : null}
    <details>
      <summary className="cursor-pointer font-semibold">Credentials</summary>
      <ul className="mt-3 grid gap-2">{credentials.map((credential) => <li className="rounded-md border border-[var(--border)] p-3" key={credential.id}>
        <div className="flex flex-wrap items-center justify-between gap-2"><span><strong>{credential.name}</strong> · {credential.status}</span><span className="flex gap-2">{credential.status === "ACTIVE" ? <><button className="crm-button crm-button-subtle" onClick={() => void credentialAction(credential.id, "rotate")} type="button">Rotate</button><button className="crm-button crm-button-subtle" onClick={() => void credentialAction(credential.id, "revoke")} type="button">Revoke</button></> : null}</span></div>
        <p className="text-sm text-[var(--muted)]">{credential.capabilities.join(", ")} · expires {new Date(credential.expiresAt).toLocaleDateString()} · last used {credential.lastUsedAt ? new Date(credential.lastUsedAt).toLocaleString() : "never"}</p>
      </li>)}</ul>
      <form action={issueCredential} className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">Name<input className="crm-control" name="name" required /></label>
        <label className="flex flex-col gap-1 text-sm font-medium">Expires at<input className="crm-control" name="expiresAt" required type="datetime-local" /></label>
        <fieldset className="grid gap-1 text-sm"><legend className="font-medium">Capabilities</legend>{["SHARED_RECORDS_READ", "SHARED_RECORDS_WRITE", "WORKFLOW_EVENTS_WRITE", "PROJECTION_DELIVER"].map((capability) => <label key={capability}><input name="capabilities" type="checkbox" value={capability} /> {capability}</label>)}</fieldset>
        <button className="crm-button crm-button-primary w-fit" type="submit">Issue credential</button>
      </form>
    </details>
    <details><summary className="cursor-pointer font-semibold">Dead letters and reconciliation</summary>
      <ul className="mt-3 grid gap-2">{deadLetters.map((letter) => <li key={letter.id}>{letter.id} · {letter.attempts} attempts · {letter.errorCode ?? "Unknown error"} <button className="underline" onClick={() => void replay(letter.id)} type="button">Replay</button></li>)}</ul>
      <ul className="mt-3 grid gap-2">{repairCandidates.map((candidate) => <li key={candidate.id}>Mismatch {candidate.id} · {candidate.sourceCount} source / {candidate.destinationCount} destination · {candidate.status}</li>)}</ul>
    </details>
    {message ? <p aria-live="polite" className="text-sm font-medium">{message}</p> : null}
  </section>;
}
