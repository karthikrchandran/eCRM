import Link from "next/link";
import type { ProductionWorkItemRecord } from "@/server/production/queries";

type ProductionBoardProps = {
  workItems: ProductionWorkItemRecord[];
};

export function ProductionBoard({ workItems }: ProductionBoardProps) {
  const statuses = ["BLOCKED", "IN_PROGRESS", "NOT_STARTED", "DONE"];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Production</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Work items created from booked order line items.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-4">
        {statuses.map((status) => {
          const items = workItems.filter((item) => item.status === status);

          return (
            <section className="surface p-4" key={status}>
              <h2 className="text-sm font-semibold">{status.replaceAll("_", " ")}</h2>
              {items.length === 0 ? <p className="mt-3 text-sm text-[var(--muted)]">No work items.</p> : null}
              <div className="mt-3 space-y-3">
                {items.map((item) => (
                  <article className="rounded-md border border-[var(--border)] p-3" key={item.id}>
                    <Link className="font-semibold text-[var(--accent-strong)] hover:underline" href={`/production/${item.id}`}>
                      {item.title}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {item.orderLineItem.order.leadCustomer.name} - {item.productCategorySnapshot}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
