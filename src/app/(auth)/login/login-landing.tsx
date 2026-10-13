import { Icon, type IconName } from "@/components/ui/icons";
import { LoginForm } from "./login-form";

const highlights: { icon: IconName; title: string; text: string }[] = [
  { icon: "trendingUp", title: "Sales pipeline", text: "Leads, opportunities, proposals, and daily sales work." },
  { icon: "factory", title: "Delivery control", text: "Order booking, production stages, owners, and due dates." },
  { icon: "wallet", title: "Finance visibility", text: "Invoices, collections, margins, and incentive readiness." }
];

export function LoginLanding() {
  return (
    <main className="min-h-screen bg-[var(--brand-navy)] text-white">
      <section className="relative isolate grid min-h-screen overflow-hidden lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgb(37_99_235_/_0.42),transparent_48%),linear-gradient(135deg,#07152f,#0f2f68)]" />

        <div className="flex flex-col justify-between gap-8 px-6 py-8 sm:px-10 lg:px-14">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#c9dcff]">
              <Icon name="shield" size={16} />
              Secure customer-cell workspace
            </p>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Lead-to-cash workspace for training, safety, software, and content delivery.
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-6 text-[#e8f2ff]">
              Track leads, proposals, booked orders, production stages, invoices, collections, and sales follow-ups in one
              secure operating view for your team.
            </p>
          </div>

          <div className="grid max-w-3xl gap-3 text-[13px] text-[#e8f2ff] sm:grid-cols-3">
            {highlights.map((item) => (
              <div className="rounded-lg border border-white/20 bg-white/10 p-4" key={item.title}>
                <span className="grid size-8 place-items-center rounded-md bg-white/15 text-white">
                  <Icon name={item.icon} size={16} />
                </span>
                <p className="mt-3 text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-1">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="flex items-center justify-center bg-white/95 px-5 py-8 text-[var(--foreground)] shadow-[-16px_0_40px_rgb(0_24_66_/_0.22)] backdrop-blur">
          <LoginForm />
        </aside>
      </section>
    </main>
  );
}
