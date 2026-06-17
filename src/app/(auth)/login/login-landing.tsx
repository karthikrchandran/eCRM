import Image from "next/image";
import { LoginForm } from "./login-form";

const heroImageUrl = "https://araglobalinc.com/wp-content/uploads/2025/10/ARA-Global-banner-4-scaled.png";

export function LoginLanding() {
  return (
    <main className="min-h-screen bg-[var(--brand-navy)] text-white">
      <section className="relative isolate grid min-h-screen overflow-hidden lg:grid-cols-[minmax(0,1fr)_28rem]">
        <Image
          fill
          alt="ARA Global safety training and workforce development"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
          priority
          sizes="100vw"
          src={heroImageUrl}
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(0_24_66_/_0.92),rgb(0_32_95_/_0.72),rgb(0_32_95_/_0.34))]" />

        <div className="flex min-h-[34rem] flex-col justify-between px-6 py-8 sm:px-10 lg:px-14">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#c9dcff]">ARA Global eCRM</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Lead-to-cash workspace for training, safety, software, and content delivery.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#e8f2ff]">
              Track leads, proposals, booked orders, production stages, invoices, collections, and sales follow-ups in one
              operating view for ARA Global teams.
            </p>
          </div>

          <div className="grid max-w-3xl gap-3 text-sm text-[#e8f2ff] sm:grid-cols-3">
            <div className="rounded-md border border-white/20 bg-white/10 p-4">
              <p className="font-semibold text-white">Sales pipeline</p>
              <p className="mt-1">Leads, opportunities, proposals, and daily sales work.</p>
            </div>
            <div className="rounded-md border border-white/20 bg-white/10 p-4">
              <p className="font-semibold text-white">Delivery control</p>
              <p className="mt-1">Order booking, production stages, owners, and due dates.</p>
            </div>
            <div className="rounded-md border border-white/20 bg-white/10 p-4">
              <p className="font-semibold text-white">Finance visibility</p>
              <p className="mt-1">Invoices, collections, margins, and incentive readiness.</p>
            </div>
          </div>
        </div>

        <aside className="flex items-center justify-center bg-white/95 px-5 py-8 text-[var(--foreground)] shadow-[-16px_0_40px_rgb(0_24_66_/_0.22)] backdrop-blur">
          <LoginForm />
        </aside>
      </section>
    </main>
  );
}
