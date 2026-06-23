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
  { href: "/my-day", label: "My Day" },
  { href: "/customer-360", label: "Customer 360" },
  { href: "/opportunities", label: "Pipeline" },
  { href: "/orders", label: "Orders" },
  { href: "/production", label: "Production" },
  { href: "/reports", label: "Reports" }
];

const adminNavItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/customer-360", label: "Customer 360" },
  { href: "/opportunities", label: "Pipeline" },
  { href: "/orders", label: "Orders" },
  { href: "/production", label: "Production" },
  { href: "/reports", label: "Reports" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/production-config", label: "Production config" },
  { href: "/admin/settings", label: "Settings" }
];

export function AppShell({ user, children }: AppShellProps) {
  if (user.role === "ADMIN") {
    return (
      <div className="min-h-screen bg-[var(--background)] md:grid md:grid-cols-[17rem_1fr]">
        <aside className="border-r border-[var(--border)] bg-white px-4 py-5">
          <Link className="text-lg font-semibold text-[var(--brand-navy)]" href="/dashboard">
            eCRM
          </Link>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Admin Console</p>
          <nav className="mt-6 grid gap-1 text-sm" aria-label="Admin navigation">
            {adminNavItems.map((item) => (
              <Link
                className="rounded-md px-3 py-2 font-semibold text-slate-700 hover:bg-[var(--surface-muted)] hover:text-[var(--brand-navy)]"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0">
          <header className="border-b border-[var(--border)] bg-slate-950 text-white" role="banner">
            <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Admin Console</p>
                <p className="text-xs text-slate-300">Company controls, reporting, configuration, and operations.</p>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0 md:hidden">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate font-medium text-white">{user.name}</p>
                    <RoleBadge role={user.role} />
                  </div>
                  <p className="truncate text-xs text-slate-300">{user.email}</p>
                </div>
                <div className="hidden text-right md:block">
                  <div className="flex items-center justify-end gap-2">
                    <p className="font-medium text-white">{user.name}</p>
                    <RoleBadge role={user.role} />
                  </div>
                  <p className="text-xs text-slate-300">{user.email}</p>
                </div>
                <form action={logoutAction}>
                  <button className="crm-button crm-button-subtle text-sm" type="submit">
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
        </div>
      </div>
    );
  }

  const navItems = baseNavItems;

  return (
    <div className="min-h-screen">
      <header className="border-b border-[rgb(255_255_255_/_0.16)] bg-[var(--brand-navy)] text-white shadow-[0_12px_28px_rgb(0_24_66_/_0.18)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start justify-between gap-3 md:block">
            <div className="min-w-0">
              <Link className="text-lg font-semibold text-white" href="/dashboard">
                eCRM
              </Link>
              <p className="text-xs text-[var(--header-muted)]">Lead-to-cash workspace</p>
            </div>
            <form action={logoutAction} className="shrink-0 md:hidden">
              <button className="crm-button crm-button-subtle text-sm" type="submit">
                Sign out
              </button>
            </form>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm md:hidden">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate font-medium text-white">{user.name}</p>
                <RoleBadge role={user.role} />
              </div>
              <p className="truncate text-xs text-[var(--header-muted)]">{user.email}</p>
            </div>
          </div>
          <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 text-sm md:mx-0 md:items-center md:overflow-visible md:px-0 md:pb-0">
            {navItems.map((item) => (
              <Link
                className="shrink-0 rounded-md px-3 py-2 font-medium text-[#dbeafe] hover:bg-white/12 hover:text-white"
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
                <p className="font-medium text-white">{user.name}</p>
                <RoleBadge role={user.role} />
              </div>
              <p className="text-xs text-[var(--header-muted)]">{user.email}</p>
            </div>
            <form action={logoutAction}>
              <button className="crm-button crm-button-subtle text-sm" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
