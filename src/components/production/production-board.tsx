import Link from "next/link";
import type { ActionState } from "@/server/production/types";
import type { ProductionWorkItemRecord } from "@/server/production/queries";
import { ProductionStageActions } from "./production-stage-actions";

type ProductionBoardProps = {
  canManageConfig: boolean;
  owners: Array<{ id: string; name: string; email: string }>;
  stageAction: (workItemId: string, stageInstanceId: string, state: ActionState, formData: FormData) => Promise<ActionState>;
  workItems: ProductionWorkItemRecord[];
};

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusClass(status: string) {
  switch (status) {
    case "DONE":
      return "border-[var(--status-positive-border)] bg-[var(--status-positive-bg)] text-[var(--status-positive-text)]";
    case "BLOCKED":
      return "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]";
    case "IN_PROGRESS":
      return "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "No due date";
  }

  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

export function ProductionBoard({ canManageConfig, owners, stageAction, workItems }: ProductionBoardProps) {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Production</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Work items created from booked order line items.</p>
        </div>
        {canManageConfig ? (
          <Link className="crm-button crm-button-secondary text-sm" href="/admin/production-config">
            Production config
          </Link>
        ) : null}
      </header>

      {workItems.length === 0 ? (
        <p className="surface p-6 text-sm text-[var(--muted)]">No production work items have been created yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-white">
          <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Product / service</th>
                <th className="px-4 py-3 font-semibold">Customer / order</th>
                <th className="px-4 py-3 font-semibold">Overall status</th>
                <th className="px-4 py-3 font-semibold">Stage progress</th>
                <th className="px-4 py-3 font-semibold">Inline stage edits</th>
              </tr>
            </thead>
            <tbody>
              {workItems.map((item) => (
                <tr className="border-t border-[var(--border)]" key={item.id}>
                  <td className="w-[22%] px-4 py-4 align-top">
                    <Link className="font-semibold text-[var(--accent-strong)] hover:underline" href={`/production/${item.id}`}>
                      {item.title}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--muted)]">{item.productCategorySnapshot}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{item.productionTemplate?.name ?? "No template"}</p>
                  </td>
                  <td className="w-[18%] px-4 py-4 align-top">
                    <p className="font-medium">{item.orderLineItem.order.leadCustomer.name}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{item.orderLineItem.order.orderNumber}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{formatDate(item.dueAt ?? item.orderLineItem.order.deliveryDueAt)}</p>
                  </td>
                  <td className="w-[12%] px-4 py-4 align-top">
                    <span className={`inline-flex rounded border px-2 py-1 text-xs font-semibold ${statusClass(item.status)}`}>
                      {formatStatus(item.status)}
                    </span>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      {item.stageInstances.filter((stage) => stage.status === "DONE" || stage.status === "SKIPPED").length}/
                      {item.stageInstances.length} complete
                    </p>
                  </td>
                  <td className="w-[22%] px-4 py-4 align-top">
                    <div className="flex flex-wrap gap-2">
                      {item.stageInstances.map((stage) => (
                        <span
                          className={`rounded border px-2 py-1 text-xs font-semibold ${statusClass(stage.status)}`}
                          key={stage.id}
                          title={stage.description ?? undefined}
                        >
                          {stage.name}: {formatStatus(stage.status)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="w-[26%] px-4 py-4 align-top">
                    <div className="space-y-3">
                      {item.stageInstances.map((stage) => {
                        const action = stageAction.bind(null, item.id, stage.id);

                        return (
                          <details className="rounded-md border border-[var(--border)] p-3" key={stage.id}>
                            <summary className="cursor-pointer text-sm font-semibold text-slate-950">{stage.name}</summary>
                            <ProductionStageActions action={action} compact owners={owners} status={stage.status} />
                          </details>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
