import Link from "next/link";
import { OrderFinanceSummary } from "@/components/finance/order-finance-summary";
import type { OrderFinanceSummary as OrderFinanceSummaryRecord } from "@/server/finance/queries";
import type { OrderRecord } from "@/server/orders/queries";

type OrderDetailProps = {
  canManageFinance: boolean;
  finance: OrderFinanceSummaryRecord | null;
  instantiateProductionAction: (orderLineItemId: string) => Promise<void>;
  order: OrderRecord;
};

function formatPaisa(value: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(value / 100)}`;
}

function formatDate(date: Date | null) {
  return date
    ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date)
    : "Not set";
}

export function OrderDetail({ canManageFinance, finance, instantiateProductionAction, order }: OrderDetailProps) {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {order.leadCustomer.name} - {order.status} - {formatPaisa(order.totalPaisa, order.currency)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="crm-button crm-button-secondary" href="/orders">
            Back to orders
          </Link>
          <Link className="crm-button crm-button-secondary" href="/production">
            Production
          </Link>
        </div>
      </header>

      <section className="surface grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Customer</p>
          <p className="font-medium">{order.leadCustomer.name}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Opportunity</p>
          <p className="font-medium">{order.opportunity.title}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Owner</p>
          <p className="font-medium">{order.owner.name}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Delivery due</p>
          <p className="font-medium">{formatDate(order.deliveryDueAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Proposal</p>
          <p className="font-medium">{order.proposal.title}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">PO number</p>
          <p className="font-medium">{order.poNumber ?? "Not set"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Subtotal</p>
          <p className="font-medium">{formatPaisa(order.subtotalPaisa, order.currency)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">GST</p>
          <p className="font-medium">{formatPaisa(order.gstPaisa, order.currency)}</p>
        </div>
      </section>

      <section className="surface overflow-x-auto p-4">
        <h2 className="text-lg font-semibold">Order line items</h2>
        <table className="mt-3 min-w-full text-left text-sm">
          <thead className="text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="py-2 pr-4">Product/service</th>
              <th className="py-2 pr-4">Qty</th>
              <th className="py-2 pr-4">Total</th>
              <th className="py-2 pr-4">Production</th>
            </tr>
          </thead>
          <tbody>
            {order.lineItems.map((line) => {
              const productionAction = instantiateProductionAction.bind(null, line.id);

              return (
                <tr className="border-t border-[var(--border)]" key={line.id}>
                  <td className="py-3 pr-4">
                    <p className="font-medium">{line.productNameSnapshot}</p>
                    <p className="text-xs text-[var(--muted)]">{line.productionTemplateKeySnapshot ?? "No template"}</p>
                  </td>
                  <td className="py-3 pr-4">{line.quantity}</td>
                  <td className="py-3 pr-4">{formatPaisa(line.lineTotalPaisa, order.currency)}</td>
                  <td className="py-3 pr-4">
                    {line.productionWorkItems.length > 0 ? (
                      <Link className="font-semibold text-[var(--accent-strong)] hover:underline" href={`/production/${line.productionWorkItems[0]?.id}`}>
                        View production
                      </Link>
                    ) : (
                      <form action={productionAction}>
                        <button className="crm-button crm-button-secondary text-sm" type="submit">
                          Create production work
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <OrderFinanceSummary canManage={canManageFinance} finance={finance} order={order} />
    </div>
  );
}
