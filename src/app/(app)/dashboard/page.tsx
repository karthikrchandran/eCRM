import { requireUser } from "@/server/auth/current-user";

const cards = [
  { label: "Open opportunities", value: "0" },
  { label: "Upcoming follow-ups", value: "0" },
  { label: "Booked value", value: "INR 0" },
  { label: "Pending payments", value: "INR 0" },
  { label: "Production pending", value: "0" },
  { label: "Incentives pending", value: "INR 0" }
];

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Signed in as {user.name}. Foundation metrics are ready for CRM modules.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <article className="surface p-4" key={card.label}>
            <p className="text-sm text-[var(--muted)]">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold">{card.value}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
