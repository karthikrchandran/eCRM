import Link from "next/link";
import { StageForm } from "@/components/opportunities/stage-form";
import { requireUser } from "@/server/auth/current-user";
import { upsertPipelineStageAction } from "@/server/opportunities/actions";
import { listOpportunityFormOptions } from "@/server/opportunities/queries";

export default async function OpportunityStagesPage() {
  const user = await requireUser();
  const { stages } = await listOpportunityFormOptions();

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pipeline stages</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Configure opportunity stage names, order, and outcome type.</p>
        </div>
        <Link className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold" href="/opportunities">
          Back to opportunities
        </Link>
      </header>

      <StageForm action={upsertPipelineStageAction} canManage={user.role === "ADMIN"} stages={stages} />
    </div>
  );
}
