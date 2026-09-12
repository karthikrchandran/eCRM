import { notFound } from "next/navigation";
import { CustomerCellOnboardingPanel } from "@/components/platform/customer-cell-onboarding-panel";
import { getServerEnv } from "@/server/env";

export default function PlatformCellsPage() {
  if (getServerEnv().runtime.mode !== "platform") notFound();
  return <main className="mx-auto grid w-full max-w-6xl gap-6 p-6"><header><p className="text-sm uppercase tracking-wide text-[var(--muted)]">Platform administration</p><h1 className="mt-1 text-3xl font-semibold">Customer cells</h1></header><CustomerCellOnboardingPanel /></main>;
}
