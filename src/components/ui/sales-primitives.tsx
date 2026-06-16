import type { UserRole } from "@prisma/client";
import { clsx } from "clsx";

type PageHeaderProps = {
  actions?: React.ReactNode;
  description?: string;
  eyebrow?: string;
  title: string;
};

type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

const statusToneClasses: Record<StatusTone, string> = {
  danger: "border-red-200 bg-red-50 text-red-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800"
};

export function PageHeader({ actions, description, eyebrow, title }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent-strong)]">{eyebrow}</p> : null}
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function RoleBadge({ role }: { role: UserRole | "ADMIN" | "SALES" }) {
  const label = role === "ADMIN" ? "Admin" : "Sales";
  const classes =
    role === "ADMIN"
      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return <span className={clsx("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", classes)}>{label}</span>;
}

export function StatusBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: StatusTone }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", statusToneClasses[tone])}>
      {children}
    </span>
  );
}

export function EmptyState({ actions, description, title }: { actions?: React.ReactNode; description: string; title: string }) {
  return (
    <div className="surface flex min-h-36 flex-col items-start justify-center p-6">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">{description}</p>
      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function MetricStrip({ metrics }: { metrics: Array<{ label: string; value: string; detail?: string }> }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <article className="surface p-4" key={metric.label}>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{metric.label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{metric.value}</p>
          {metric.detail ? <p className="mt-1 text-xs text-[var(--muted)]">{metric.detail}</p> : null}
        </article>
      ))}
    </section>
  );
}
