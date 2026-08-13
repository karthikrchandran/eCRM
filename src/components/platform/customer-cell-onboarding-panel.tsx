"use client";

import { useState } from "react";

type CellSummary = { id: string; cellKey?: string; displayName?: string; lifecycleStatus?: string };

const initialForm = {
  cellId: "",
  cellKey: "",
  legalName: "",
  displayName: "",
  region: "",
  desiredSubdomain: "",
  planCode: "ENTERPRISE",
  initialAdminEmail: ""
};

export function CustomerCellOnboardingPanel() {
  const [token, setToken] = useState("");
  const [form, setForm] = useState(initialForm);
  const [cells, setCells] = useState<CellSummary[]>([]);
  const [message, setMessage] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function refreshCells() {
    if (!token.trim()) return;
    const response = await fetch("/api/platform/cells", { headers: { Authorization: `Bearer ${token.trim()}` } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? "Unable to list customer cells.");
    setCells(body.cells ?? []);
  }

  function updateField(field: keyof typeof initialForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(undefined);
    try {
      const response = await fetch("/api/platform/cells", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token.trim()}` },
        body: JSON.stringify({
          ...form,
          allowedModules: ["crm", "opportunities", "proposals", "orders", "production", "finance", "reports"],
          idempotencyKey: `ui-${form.cellId}-${Date.now()}`,
          correlationId: crypto.randomUUID(),
          reason: "Platform administrator customer-cell onboarding"
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to provision customer cell.");
      setMessage("Customer cell provisioned.");
      await refreshCells();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to provision customer cell.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      <form className="surface grid gap-4 p-4 sm:p-6" onSubmit={submit}>
        <div>
          <h2 className="text-lg font-semibold">Provision a customer cell</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">The token is used only for this browser session and is never sent to the page server.</p>
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium">Platform bearer token<input aria-label="Platform bearer token" className="crm-control" onChange={(event) => setToken(event.target.value)} type="password" value={token} /></label>
        <div className="grid gap-4 md:grid-cols-2">
          {(["cellId", "cellKey", "legalName", "displayName", "region", "desiredSubdomain", "planCode", "initialAdminEmail"] as const).map((field) => (
            <label className="flex flex-col gap-1 text-sm font-medium" key={field}>{field === "desiredSubdomain" ? "Subdomain" : field.replace(/[A-Z]/g, (letter) => ` ${letter}`).replace(/^./, (letter) => letter.toUpperCase())}<input aria-label={field === "desiredSubdomain" ? "Subdomain" : field.replace(/[A-Z]/g, (letter) => ` ${letter}`).replace(/^./, (letter) => letter.toUpperCase())} className="crm-control" onChange={(event) => updateField(field, event.target.value)} type={field === "initialAdminEmail" ? "email" : "text"} value={form[field]} /></label>
          ))}
        </div>
        <button className="crm-button crm-button-primary w-fit" disabled={loading} type="submit">{loading ? "Provisioning..." : "Provision customer cell"}</button>
      </form>

      {message ? <p aria-live="polite" className="text-sm font-medium">{message}</p> : null}
      <section className="surface p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Customer cells</h2><button className="crm-button crm-button-subtle" onClick={() => void refreshCells().catch((error) => setMessage(error instanceof Error ? error.message : "Unable to list customer cells."))} type="button">Refresh</button></div>
        <ul className="mt-4 grid gap-2">{cells.map((cell) => <li className="rounded-md border border-[var(--border)] p-3" key={cell.id}><span className="font-medium">{cell.displayName ?? cell.id}</span> <span className="text-sm text-[var(--muted)]">{cell.lifecycleStatus ?? "UNKNOWN"}</span></li>)}</ul>
      </section>
    </div>
  );
}
