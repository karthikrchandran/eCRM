import { LoginForm } from "./login-form";

const capabilities = [
  {
    title: "Build momentum",
    description: "Keep opportunities, decisions, and next actions moving."
  },
  {
    title: "Deliver with clarity",
    description: "Coordinate commitments, owners, milestones, and due dates."
  },
  {
    title: "See the whole picture",
    description: "Connect commercial progress, delivery, and cash in one view."
  }
] as const;

export function LoginLanding() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#07111f] text-white">
      <section className="relative isolate grid min-h-screen lg:grid-cols-[minmax(0,1fr)_28rem]">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_16%_18%,rgb(59_130_246_/_0.3),transparent_34%),radial-gradient(circle_at_72%_82%,rgb(14_165_233_/_0.18),transparent_38%),linear-gradient(135deg,#06111f_0%,#102a43_55%,#0b1d31_100%)]"
        />
        <div
          aria-hidden="true"
          className="absolute -left-40 top-1/2 -z-10 h-[34rem] w-[34rem] -translate-y-1/2 rounded-full border border-white/10"
        />
        <div
          aria-hidden="true"
          className="absolute left-24 top-1/2 -z-10 h-[24rem] w-[24rem] -translate-y-1/2 rounded-full border border-sky-300/15"
        />

        <div className="flex min-h-[34rem] flex-col justify-between px-6 py-8 sm:px-10 lg:px-14">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-200">CommitArc</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Turn every customer commitment into coordinated action.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200">
              Bring conversations, commercial decisions, delivery, and collections into one shared operating view.
            </p>
          </div>

          <div className="grid max-w-3xl gap-3 text-sm text-slate-200 sm:grid-cols-3">
            {capabilities.map((capability) => (
              <div
                className="rounded-xl border border-white/15 bg-white/[0.08] p-4 backdrop-blur-sm"
                key={capability.title}
              >
                <p className="font-semibold text-white">{capability.title}</p>
                <p className="mt-1 leading-6">{capability.description}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="flex items-center justify-center bg-white/[0.96] px-5 py-8 text-[var(--foreground)] shadow-[-16px_0_40px_rgb(2_12_27_/_0.32)] backdrop-blur">
          <LoginForm />
        </aside>
      </section>
    </main>
  );
}
