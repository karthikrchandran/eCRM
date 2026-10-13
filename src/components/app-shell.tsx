import type { UserRole } from "@prisma/client";
import { ShellSidebar, type ShellNavGroup } from "@/components/app-shell-nav";
import { RoleBadge } from "@/components/ui/sales-primitives";
import { Icon, type IconName } from "@/components/ui/icons";
import { logoutAction } from "@/server/auth/actions";

type AppShellProps = {
  user: {
    name: string;
    email: string;
    role: UserRole;
  };
  children: React.ReactNode;
  enabledModules?: string[];
};

type NavItem = { href: string; label: string; icon: IconName; module: string | null; roles?: UserRole[] };

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard", module: "crm" },
      { href: "/my-day", label: "My Day", icon: "calendarCheck", module: "crm", roles: ["SALES"] }
    ]
  },
  {
    label: "Customers",
    items: [
      { href: "/leads", label: "Leads", icon: "userPlus", module: "crm", roles: ["SALES"] },
      { href: "/contacts", label: "Contacts", icon: "contact", module: "crm", roles: ["SALES"] },
      { href: "/customer-360", label: "Customer 360", icon: "building", module: "crm" }
    ]
  },
  {
    label: "Sales",
    items: [
      { href: "/opportunities", label: "Pipeline", icon: "trendingUp", module: "crm" },
      { href: "/orders", label: "Orders", icon: "clipboardList", module: "orders", roles: ["ADMIN"] },
      { href: "/performance", label: "Performance", icon: "target", module: "reports", roles: ["SALES"] },
      { href: "/admin/performance", label: "Team performance", icon: "users", module: "reports", roles: ["ADMIN"] }
    ]
  },
  {
    label: "Finance and reports",
    items: [
      { href: "/finance", label: "Finance", icon: "wallet", module: "finance" },
      { href: "/incentives", label: "Incentives", icon: "award", module: "finance", roles: ["ADMIN"] },
      { href: "/reports", label: "Reports", icon: "fileChart", module: "reports" }
    ]
  },
  {
    label: "Setup",
    items: [
      { href: "/production", label: "Production", icon: "factory", module: "production", roles: ["ADMIN"] },
      { href: "/admin/products", label: "Products", icon: "package", module: "production", roles: ["ADMIN"] },
      { href: "/admin/production-config", label: "Production config", icon: "sliders", module: "production", roles: ["ADMIN"] },
      { href: "/admin/settings", label: "Settings", icon: "settings", module: null, roles: ["ADMIN"] }
    ]
  }
];

export function AppShell({ user, children, enabledModules = ["crm", "proposals", "orders", "production", "finance", "reports"] }: AppShellProps) {
  const isVisible = (item: NavItem) =>
    (item.module === null || enabledModules.includes(item.module)) && (!item.roles || item.roles.includes(user.role));

  const groups: ShellNavGroup[] = navGroups
    .map((group) => ({ label: group.label, items: group.items.filter(isVisible).map(({ href, label, icon }) => ({ href, label, icon })) }))
    .filter((group) => group.items.length > 0);

  const footer = (
    <div className="border-t border-white/15 px-4 py-3 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <p className="truncate font-medium text-white">{user.name}</p>
        <RoleBadge role={user.role} />
      </div>
      <p className="truncate text-xs text-[var(--header-muted)]">{user.email}</p>
      <form action={logoutAction} className="mt-2.5">
        <button className="crm-button crm-button-subtle w-full gap-2 !min-h-9 text-[13px]" type="submit">
          <Icon name="logOut" size={15} />
          Sign out
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--background)] md:grid md:grid-cols-[14.5rem_1fr]">
      <ShellSidebar footer={footer} groups={groups} subtitle={user.role === "ADMIN" ? "Admin Console" : "Lead-to-cash workspace"} />
      <div className="min-w-0">
        <main className="app-content mx-auto max-w-[88rem] px-4 py-5 md:px-6">{children}</main>
      </div>
    </div>
  );
}
