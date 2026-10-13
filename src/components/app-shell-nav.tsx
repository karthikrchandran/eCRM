"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon, type IconName } from "@/components/ui/icons";

export type ShellNavGroup = {
  label: string;
  items: { href: string; label: string; icon: IconName }[];
};

function isActive(pathname: string | null, href: string) {
  return pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
}

export function ShellSidebar({ groups, subtitle, footer }: { groups: ShellNavGroup[]; subtitle: string; footer: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between bg-[var(--brand-navy)] px-4 py-2.5 text-white md:hidden">
        <span className="flex items-center gap-2 text-base font-semibold">
          <span className="grid size-7 place-items-center rounded-md bg-white/15">
            <Icon name="trendingUp" size={16} />
          </span>
          eCRM
        </span>
        <button
          aria-controls="app-sidebar"
          aria-expanded={open}
          aria-label={open ? "Close navigation" : "Open navigation"}
          className="crm-button crm-button-subtle gap-2 text-sm"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <Icon name={open ? "close" : "menu"} size={16} />
          {open ? "Close" : "Menu"}
        </button>
      </header>
      <aside
        className={clsx(
          "flex-col bg-[var(--brand-navy)] text-white md:sticky md:top-0 md:flex md:h-screen md:self-start md:overflow-hidden",
          open ? "flex" : "hidden"
        )}
        id="app-sidebar"
      >
        <div className="hidden items-center gap-2.5 px-4 pb-1 pt-4 md:flex">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/15">
            <Icon name="trendingUp" size={18} />
          </span>
          <div className="min-w-0">
            <Link className="block text-base font-semibold leading-tight text-white" href="/dashboard">
              eCRM
            </Link>
            <p className="truncate text-[11px] leading-tight text-[var(--header-muted)]">{subtitle}</p>
          </div>
        </div>
        <nav aria-label="Main navigation" className="flex min-h-0 flex-1 flex-col justify-evenly px-2.5 py-2">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-2.5 pb-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--header-muted)]">{group.label}</p>
              <ul className="grid gap-px">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        aria-current={active ? "page" : undefined}
                        className={clsx(
                          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-white",
                          active ? "bg-white/20 text-white" : "text-[#dbeafe] hover:bg-white/12 hover:text-white"
                        )}
                        href={item.href}
                        onClick={() => setOpen(false)}
                      >
                        <Icon className={active ? "text-white" : "text-[var(--header-muted)]"} name={item.icon} size={16} />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        {footer}
      </aside>
    </>
  );
}
