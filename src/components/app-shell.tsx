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
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <Link className="text-lg font-semibold" href="/dashboard">
              eCRM
            </Link>
            <p className="text-xs text-[var(--muted)]">Lead-to-cash workspace</p>
          </div>
          <nav className="hidden items-center gap-3 text-sm md:flex">
            {navItems.map((item) => (
              <Link className="rounded-md px-2 py-1 hover:bg-slate-100" href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <div className="hidden text-right sm:block">
              <p className="font-medium">{user.name}</p>
              <p className="text-xs text-[var(--muted)]">{user.role}</p>
            </div>
            <form action={logoutAction}>
              <button className="rounded-md border border-[var(--border)] px-3 py-2" type="submit">
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
