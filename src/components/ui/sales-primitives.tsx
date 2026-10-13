import type { OrganizationRole } from "@prisma/client";
import { clsx } from "clsx";
import { Icon, type IconName } from "@/components/ui/icons";

type PageHeaderProps = {
  actions?: React.ReactNode;
  description?: string;
  eyebrow?: string;
  icon?: IconName;
  title: string;
};

type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

const statusToneClasses: Record<StatusTone, string> = {
  danger: "border-red-200 bg-red-50 text-red-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  success: "border-[var(--status-positive-border)] bg-[var(--status-positive-bg)] text-[var(--status-positive-text)]",
  warning: "border-amber-200 bg-amber-50 text-amber-800"
};

export function PageHeader({ actions, description, eyebrow, icon, title }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {icon ? (
          <span className="hidden size-10 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--brand-navy)] sm:grid">
            <Icon name={icon} size={20} />
          </span>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--accent-strong)]">{eyebrow}</p> : null}
          <h1 className="text-xl font-semibold leading-tight text-slate-950">{title}</h1>
          {description ? <p className="mt-0.5 max-w-3xl text-[13px] text-[var(--muted)]">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function RoleBadge({ role }: { role: OrganizationRole }) {
  const label = role
    .toLowerCase()
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
  const classes =
    role === "ADMIN"
      ? "border-[#bfdbfe] bg-[#eff6ff] text-[var(--brand-navy)]"
      : "border-[var(--status-positive-border)] bg-[var(--status-positive-bg)] text-[var(--status-positive-text)]";

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
    <div className="surface flex min-h-28 items-center gap-4 p-5">
      <span className="hidden size-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 sm:grid">
        <Icon name="inbox" size={20} />
      </span>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        <p className="mt-0.5 max-w-2xl text-[13px] text-[var(--muted)]">{description}</p>
        {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

const metricIcons: IconName[] = ["barChart", "users", "calendarCheck", "trendingUp", "wallet", "target"];

export function MetricStrip({ metrics }: { metrics: Array<{ label: string; value: string; detail?: string }> }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric, index) => (
        <article className="surface flex items-start justify-between gap-3 px-4 py-3" key={metric.label}>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">{metric.label}</p>
            <p className="mt-1 text-xl font-semibold leading-tight text-slate-950 tabular-nums">{metric.value}</p>
            {metric.detail ? <p className="mt-0.5 text-xs text-[var(--muted)]">{metric.detail}</p> : null}
          </div>
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--accent-soft)] text-[var(--brand-navy)]">
            <Icon name={metricIcons[index % metricIcons.length] ?? "barChart"} size={16} />
          </span>
        </article>
      ))}
    </section>
  );
}
