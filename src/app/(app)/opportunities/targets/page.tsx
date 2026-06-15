import Link from "next/link";
import { TargetForm } from "@/components/opportunities/target-form";
import { requireUser } from "@/server/auth/current-user";
import { upsertSalesTargetAction } from "@/server/opportunities/actions";
import { listOpportunityFormOptions, listSalesTargets } from "@/server/opportunities/queries";

export default async function OpportunityTargetsPage() {
  const user = await requireUser();
  const [options, targets] = await Promise.all([listOpportunityFormOptions(), listSalesTargets(user)]);
  const serializableTargets = targets.map((target) => ({
    ...target,
    targetValueInr: target.targetValueInr.toString()
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sales targets</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Quarterly owner targets for the active pipeline.</p>
        </div>
        <Link className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold" href="/opportunities">
          Back to opportunities
        </Link>
      </header>

      <TargetForm action={upsertSalesTargetAction} owners={options.owners} targets={serializableTargets} />
    </div>
  );
}
