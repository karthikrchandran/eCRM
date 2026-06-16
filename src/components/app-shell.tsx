import type { UserRole } from "@prisma/client";
import Link from "next/link";
import { logoutAction } from "@/server/auth/actions";
import { RoleBadge } from "@/components/ui/sales-primitives";

type AppShellProps = {
  user: {
    name: string;
    email: string;
    role: UserRole;
  };
  children: React.ReactNode;
};

const baseNavItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/orders", label: "Orders" },
  { href: "/production", label: "Production" },
  { href: "/reports", label: "Reports" }
];

export function AppShell({ user, children }: AppShellProps) {
  const navItems = user.role === "ADMIN" ? [...baseNavItems, { href: "/admin/products", label: "Products" }] : baseNavItems;

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start justify-between gap-3 md:block">
            <div className="min-w-0">
              <Link className="text-lg font-semibold text-slate-950" href="/dashboard">
                eCRM
              </Link>
              <p className="text-xs text-[var(--muted)]">Lead-to-cash workspace</p>
            </div>
            <form action={logoutAction} className="shrink-0 md:hidden">
              <button className="crm-button crm-button-secondary text-sm" type="submit">
                Sign out
              </button>
            </form>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm md:hidden">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate font-medium text-slate-950">{user.name}</p>
                <RoleBadge role={user.role} />
              </div>
              <p className="truncate text-xs text-[var(--muted)]">{user.email}</p>
            </div>
          </div>
          <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 text-sm md:mx-0 md:items-center md:overflow-visible md:px-0 md:pb-0">
            {navItems.map((item) => (
              <Link
                className="shrink-0 rounded-md px-3 py-2 font-medium text-slate-700 hover:bg-[var(--surface-muted)] hover:text-slate-950"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-3 text-sm md:flex">
            <div className="hidden text-right sm:block">
              <div className="flex items-center justify-end gap-2">
                <p className="font-medium text-slate-950">{user.name}</p>
                <RoleBadge role={user.role} />
              </div>
              <p className="text-xs text-[var(--muted)]">{user.email}</p>
            </div>
            <form action={logoutAction}>
              <button className="crm-button crm-button-secondary text-sm" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
