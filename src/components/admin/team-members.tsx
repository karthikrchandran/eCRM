"use client";

import { FormEvent, useState } from "react";
import { PageHeader, RoleBadge, StatusBadge } from "@/components/ui/sales-primitives";

type Membership = {
  id: string;
  role: "OWNER" | "ADMIN" | "SALES" | "FINANCE" | "PRODUCTION" | "READ_ONLY";
  status: "INVITED" | "ACTIVE" | "SUSPENDED" | "REVOKED";
  user: { id: string; name: string; email: string; active: boolean };
};

type TeamMembersProps = { initialMembers: Membership[]; currentMembershipId: string; canManage?: boolean };

function statusTone(status: Membership["status"]) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "SUSPENDED" || status === "INVITED") return "warning" as const;
  return "danger" as const;
}

export function TeamMembers({ initialMembers, currentMembershipId, canManage = true }: TeamMembersProps) {
  const [members, setMembers] = useState(initialMembers);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Membership["role"]>("SALES");
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!canManage) {
    return <div className="surface p-6 text-sm font-semibold text-red-700">Organization administrator access required.</div>;
  }

  async function refreshMembers() {
    const response = await fetch("/api/admin/memberships");
    if (!response.ok) throw new Error("Unable to refresh members.");
    const body = (await response.json()) as { memberships: Membership[] };
    setMembers(body.memberships);
  }

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch("/api/admin/memberships", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, email, role }) });
    if (!response.ok) {
      setMessage(((await response.json()) as { error?: string }).error ?? "Unable to invite member.");
      return;
    }
    await refreshMembers();
    setName("");
    setEmail("");
    setRole("SALES");
    setMessage(`Invitation sent to ${email}`);
  }

  async function updateStatus(member: Membership, status: "ACTIVE" | "SUSPENDED" | "REVOKED") {
    setBusyId(member.id);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/memberships", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ membershipId: member.id, status }) });
      if (!response.ok) {
        setMessage(((await response.json()) as { error?: string }).error ?? "Unable to update membership.");
        return;
      }
      await refreshMembers();
    } catch {
      setMessage("Unable to update membership.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin" title="Team access" description="Invite employees and manage tenant membership access." />
      <section className="surface p-5" aria-labelledby="invite-title">
        <h2 className="text-base font-semibold text-slate-950" id="invite-title">Invite a team member</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_12rem_auto] md:items-end" onSubmit={invite}>
          <label className="grid gap-1 text-sm font-medium text-slate-700">Name<input className="crm-input" value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">Email<input className="crm-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">Role<select className="crm-input" value={role} onChange={(event) => setRole(event.target.value as Membership["role"])}><option value="SALES">Sales</option><option value="ADMIN">Admin</option><option value="FINANCE">Finance</option><option value="PRODUCTION">Production</option><option value="READ_ONLY">Read only</option></select></label>
          <button className="crm-button crm-button-primary" type="submit">Invite member</button>
        </form>
        {message ? <p className="mt-3 text-sm text-[var(--muted)]" role="status">{message}</p> : null}
      </section>
      <section className="surface overflow-hidden" aria-labelledby="members-title">
        <div className="border-b border-[var(--border)] px-5 py-4"><h2 className="text-base font-semibold text-slate-950" id="members-title">Members</h2><p className="mt-1 text-sm text-[var(--muted)]">Access is scoped to this organization.</p></div>
        <div className="divide-y divide-[var(--border)]">
          {members.map((member) => <article className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between" key={member.id}>
            <div className="min-w-0"><p className="font-semibold text-slate-950">{member.user.name}</p><p className="text-sm text-[var(--muted)]">{member.user.email}</p><div className="mt-2 flex flex-wrap gap-2"><RoleBadge role={member.role} /><StatusBadge tone={statusTone(member.status)}>{member.status}</StatusBadge></div></div>
            <div className="flex flex-wrap gap-2">
              {member.status !== "ACTIVE" ? <button className="crm-button crm-button-subtle" disabled={busyId === member.id} onClick={() => updateStatus(member, "ACTIVE")} type="button">Activate {member.user.name}</button> : null}
              {member.status === "ACTIVE" && member.id !== currentMembershipId ? <button className="crm-button crm-button-subtle" disabled={busyId === member.id} onClick={() => updateStatus(member, "SUSPENDED")} type="button">Suspend {member.user.name}</button> : null}
              {member.status !== "REVOKED" && member.id !== currentMembershipId ? <button className="crm-button crm-button-subtle text-red-700" disabled={busyId === member.id} onClick={() => updateStatus(member, "REVOKED")} type="button">Revoke</button> : null}
            </div>
          </article>)}
        </div>
      </section>
    </div>
  );
}
