import Link from "next/link";
import type { ActionState } from "@/server/production/types";
import type { ProductionWorkItemRecord } from "@/server/production/queries";
import { ProductionStageActions } from "./production-stage-actions";

type ProductionDetailProps = {
  owners: Array<{ id: string; name: string; email: string }>;
  stageAction: (stageInstanceId: string, state: ActionState, formData: FormData) => Promise<ActionState>;
  workItem: ProductionWorkItemRecord;
};

export function ProductionDetail({ owners, stageAction, workItem }: ProductionDetailProps) {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{workItem.title}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {workItem.orderLineItem.order.leadCustomer.name} - {workItem.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="crm-button crm-button-secondary" href="/production">
            Back to production
          </Link>
          <Link className="crm-button crm-button-secondary" href={`/orders/${workItem.orderLineItem.order.id}`}>
            View order
          </Link>
        </div>
      </header>

      <section className="surface p-4">
        <h2 className="text-lg font-semibold">Stages</h2>
        <div className="mt-3 space-y-3">
          {workItem.stageInstances.map((stage) => (
            <article className="rounded-md border border-[var(--border)] p-3" key={stage.id}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-semibold">{stage.name}</h3>
                  <p className="text-sm text-[var(--muted)]">{stage.description ?? "No description"}</p>
                </div>
                <p className="text-sm font-semibold">{stage.status}</p>
              </div>
              <ProductionStageActions action={stageAction.bind(null, stage.id)} owners={owners} status={stage.status} />
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
