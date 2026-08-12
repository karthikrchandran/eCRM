"use client";

import { useState } from "react";

import type { CellConfigurationRecord, LocalUserRecord } from "@/server/cell-admin/service";
import { cellModules } from "@/server/cell-admin/module-catalog";

const moduleLabels: Record<string, string> = {
  crm: "CRM",
  opportunities: "Opportunities",
  proposals: "Proposals",
  orders: "Orders",
  production: "Production",
  finance: "Finance",
  reports: "Reports"
};

export function CellAdministrationPanel({
  configuration,
  users
}: {
  configuration: CellConfigurationRecord;
  users: LocalUserRecord[];
}) {
  const [message, setMessage] = useState<string>();
  const [localUsers, setLocalUsers] = useState(users);
  const [currentConfiguration, setCurrentConfiguration] = useState(configuration);

  async function saveConfiguration(formData: FormData) {
    const enabledModules = currentConfiguration.allowedModules.filter((module) => formData.getAll("enabledModules").includes(module));
    const response = await fetch("/api/admin/cell-configuration", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: formData.get("displayName"),
        logoUrl: formData.get("logoUrl"),
        supportUrl: formData.get("supportUrl"),
        legalUrl: formData.get("legalUrl"),
        primaryColor: formData.get("primaryColor"),
        locale: formData.get("locale"),
        timezone: formData.get("timezone"),
        enabledModules,
        revision: currentConfiguration.revision,
        correlationId: crypto.randomUUID(),
        reason: "Customer administrator settings update"
      })
    });
    const body = await response.json();
    if (response.ok) setCurrentConfiguration(body.configuration);
    setMessage(response.ok ? "Workspace settings saved." : body.error ?? "Unable to save workspace settings.");
  }

  async function addUser(formData: FormData) {
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        password: formData.get("password"),
        role: formData.get("role"),
        correlationId: crypto.randomUUID(),
        reason: "Customer administrator user update"
      })
    });
    const body = await response.json();
    if (response.ok) setLocalUsers((current) => [...current, body.user]);
    setMessage(response.ok ? "Local user created." : body.error ?? "Unable to create local user.");
  }

  async function toggleUser(user: LocalUserRecord) {
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        active: !user.active,
        correlationId: crypto.randomUUID(),
        reason: user.active ? "Customer administrator suspended local user" : "Customer administrator reactivated local user"
      })
    });
    const body = await response.json();
    if (response.ok) setLocalUsers((current) => current.map((entry) => entry.id === body.user.id ? body.user : entry));
    setMessage(response.ok ? "Local user updated." : body.error ?? "Unable to update local user.");
  }

  return (
    <div className="grid gap-6">
      <form action={saveConfiguration} className="surface grid gap-5 p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">Workspace identity and modules</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Plan: {currentConfiguration.planCode}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">Display name<input className="crm-control" defaultValue={currentConfiguration.displayName} name="displayName" required /></label>
          <label className="flex flex-col gap-1 text-sm font-medium">Logo URL<input className="crm-control" defaultValue={currentConfiguration.logoUrl ?? ""} name="logoUrl" type="url" /></label>
          <label className="flex flex-col gap-1 text-sm font-medium">Support URL<input className="crm-control" defaultValue={currentConfiguration.supportUrl ?? ""} name="supportUrl" type="url" /></label>
          <label className="flex flex-col gap-1 text-sm font-medium">Legal URL<input className="crm-control" defaultValue={currentConfiguration.legalUrl ?? ""} name="legalUrl" type="url" /></label>
          <label className="flex flex-col gap-1 text-sm font-medium">Primary color<input className="crm-control h-11" defaultValue={currentConfiguration.primaryColor} name="primaryColor" type="color" /></label>
          <label className="flex flex-col gap-1 text-sm font-medium">Locale<input className="crm-control" defaultValue={currentConfiguration.locale} name="locale" required /></label>
          <label className="flex flex-col gap-1 text-sm font-medium">Timezone<input className="crm-control" defaultValue={currentConfiguration.timezone} name="timezone" required /></label>
        </div>
        <fieldset className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <legend className="mb-2 text-sm font-semibold">Included modules</legend>
          {cellModules.map((module) => currentConfiguration.allowedModules.includes(module) ? (
              <label className="flex items-center gap-2 text-sm" key={module}>
                <input defaultChecked={currentConfiguration.enabledModules.includes(module)} name="enabledModules" type="checkbox" value={module} />
                {moduleLabels[module] ?? module}
              </label>
            ) : <span className="text-sm text-[var(--muted)]" key={module}>{moduleLabels[module] ?? module} - Plan-limited</span>)}
        </fieldset>
        <button className="crm-button crm-button-primary w-fit" type="submit">Save workspace settings</button>
      </form>

      <details className="surface p-4 sm:p-6">
        <summary className="cursor-pointer font-semibold">Add or change local users</summary>
        <div className="mt-5 grid gap-5">
          <ul className="grid gap-2">
            {localUsers.map((user) => (
              <li className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] p-3" key={user.id}>
                <div><p className="font-medium">{user.name}</p><p className="text-sm text-[var(--muted)]">{user.email} · {user.role === "ADMIN" ? "Admin role" : "Sales role"}</p></div>
                <button className="crm-button crm-button-subtle" onClick={() => void toggleUser(user)} type="button">{user.active ? "Suspend" : "Reactivate"}</button>
              </li>
            ))}
          </ul>
          <form action={addUser} className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium">Name<input className="crm-control" name="name" required /></label>
            <label className="flex flex-col gap-1 text-sm font-medium">Email<input className="crm-control" name="email" required type="email" /></label>
            <label className="flex flex-col gap-1 text-sm font-medium">Temporary password<input className="crm-control" minLength={12} name="password" required type="password" /></label>
            <label className="flex flex-col gap-1 text-sm font-medium">Role<select className="crm-control" defaultValue="SALES" name="role"><option value="SALES">Sales</option><option value="ADMIN">Admin</option></select></label>
            <button className="crm-button crm-button-primary w-fit" type="submit">Add local user</button>
          </form>
        </div>
      </details>
      {message ? <p aria-live="polite" className="text-sm font-medium">{message}</p> : null}
    </div>
  );
}
