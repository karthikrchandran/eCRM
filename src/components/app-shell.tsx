import type { UserRole } from "@prisma/client";
import Link from "next/link";
import { logoutAction } from "@/server/auth/actions";

type AppShellProps = {
  user: {
    name: string;
    email: string;
    role: UserRole;
  };
  children: React.ReactNode;
};

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/orders", label: "Orders" },
  { href: "/reports", label: "Reports" }
];

export function AppShell({ user, children }: AppShellProps) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start justify-between gap-3 md:block">
            <div className="min-w-0">
              <Link className="text-lg font-semibold" href="/dashboard">
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
          <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 text-sm md:mx-0 md:items-center md:overflow-visible md:px-0 md:pb-0">
            {navItems.map((item) => (
              <Link className="shrink-0 rounded-md px-3 py-2 hover:bg-slate-100" href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-3 text-sm md:flex">
            <div className="hidden text-right sm:block">
              <p className="font-medium">{user.name}</p>
              <p className="text-xs text-[var(--muted)]">{user.role}</p>
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
