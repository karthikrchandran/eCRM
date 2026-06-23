import type { OrderRecord } from "@/server/orders/queries";
import type { OrderFinanceSummary } from "@/server/finance/queries";
import { calculateApprovedCostTotal, calculateOrderPaymentSummary } from "@/server/finance/calculations";
import {
  approveIncentiveAction,
  changeCostComponentStatusAction,
  createCostComponentAction,
  createInvoiceAction,
  recordPaymentAction
} from "@/server/finance/actions";
import { CostComponentForm } from "./cost-component-form";
import { IncentiveApprovalForm } from "./incentive-panel";
import { InvoiceForm } from "./invoice-form";
import { PaymentForm } from "./payment-form";
import { StatusBadge } from "@/components/ui/sales-primitives";

function formatPaisa(value: number, currency: string) {
  const locale = currency === "USD" ? "en-US" : "en-IN";

  return `${currency} ${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(value / 100)}`;
}

function formatDate(date: Date | null) {
  return date ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date) : "Not set";
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)}%`;
}

export function OrderFinanceSummary({
  canManage,
  finance,
  order
}: {
  canManage: boolean;
  finance: OrderFinanceSummary | null;
  order: OrderRecord;
}) {
  const invoices = finance?.invoices ?? [];
  const payments = finance?.payments ?? [];
  const costs = finance?.costComponents ?? [];
  const incentive = finance?.incentive ?? null;
  const paymentSummary = calculateOrderPaymentSummary(order.totalPaisa, invoices, payments);
  const approvedCostTotalPaisa = calculateApprovedCostTotal(costs);
  const grossMarginPaisa = order.subtotalPaisa - approvedCostTotalPaisa;
  const paymentCoverage = paymentSummary.invoiceTotalPaisa
    ? Math.min(100, (paymentSummary.collectedPaisa / paymentSummary.invoiceTotalPaisa) * 100)
    : 0;
  const receivableStatus = paymentSummary.pendingReceivablePaisa > 0 ? "Collection pending" : "Clear";
  const approveAction = incentive ? approveIncentiveAction.bind(null, incentive.id) : null;

  return (
    <section className="surface space-y-5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Finance command center</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Invoices, payments, approved costs, margin, and incentive readiness.</p>
        </div>
        <StatusBadge tone={paymentSummary.pendingReceivablePaisa > 0 ? "warning" : "success"}>{receivableStatus}</StatusBadge>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <article className="rounded-md border border-[var(--border)] bg-slate-50 p-4">
          <p className="text-xs uppercase text-[var(--muted)]">Receivable status</p>
          <p className="mt-2 text-lg font-semibold">{receivableStatus}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{formatPaisa(paymentSummary.pendingReceivablePaisa, order.currency)} still open</p>
        </article>
        <article className="rounded-md border border-[var(--border)] bg-slate-50 p-4">
          <p className="text-xs uppercase text-[var(--muted)]">Payment coverage</p>
          <p className="mt-2 text-lg font-semibold">{formatPercent(paymentCoverage)}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {formatPaisa(paymentSummary.collectedPaisa, order.currency)} collected against invoices
          </p>
        </article>
        <article className="rounded-md border border-[var(--border)] bg-slate-50 p-4">
          <p className="text-xs uppercase text-[var(--muted)]">Gross margin</p>
          <p className="mt-2 text-lg font-semibold">{formatPaisa(grossMarginPaisa, order.currency)}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{formatPaisa(approvedCostTotalPaisa, order.currency)} approved costs</p>
        </article>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Invoiced</p>
          <p className="font-medium">{formatPaisa(paymentSummary.invoiceTotalPaisa, order.currency)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Collected</p>
          <p className="font-medium">{formatPaisa(paymentSummary.collectedPaisa, order.currency)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Pending receivable</p>
          <p className="font-medium">{formatPaisa(paymentSummary.pendingReceivablePaisa, order.currency)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Uninvoiced</p>
          <p className="font-medium">{formatPaisa(paymentSummary.uninvoicedPaisa, order.currency)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Approved costs</p>
          <p className="font-medium">{formatPaisa(approvedCostTotalPaisa, order.currency)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Gross margin</p>
          <p className="font-medium">{formatPaisa(grossMarginPaisa, order.currency)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Incentive status</p>
          <p className="font-medium">{incentive?.status ?? "NOT_READY"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Payable incentive</p>
          <p className="font-medium">{formatPaisa(incentive?.payableAmountPaisa ?? 0, order.currency)}</p>
        </div>
      </div>

      {canManage ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <div>
            <h3 className="text-base font-semibold">Invoice</h3>
            <div className="mt-3">
              <InvoiceForm
                action={createInvoiceAction}
                currency={order.currency}
                defaultGstPaisa={order.gstPaisa}
                defaultSubtotalPaisa={order.subtotalPaisa}
                orderId={order.id}
              />
            </div>
          </div>
          <div>
            <h3 className="text-base font-semibold">Payment</h3>
            <div className="mt-3">
              <PaymentForm action={recordPaymentAction} currency={order.currency} invoices={invoices} orderId={order.id} />
            </div>
          </div>
          <div>
            <h3 className="text-base font-semibold">Cost</h3>
            <div className="mt-3">
              <CostComponentForm
                action={createCostComponentAction}
                currency={order.currency}
                orderId={order.id}
                orderLineItems={order.lineItems}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div>
          <h3 className="text-base font-semibold">Invoices</h3>
          <div className="mt-2 space-y-2 text-sm">
            {invoices.length === 0 ? <p className="text-[var(--muted)]">No invoices yet.</p> : null}
            {invoices.map((invoice) => (
              <div className="rounded-md border border-[var(--border)] p-3" key={invoice.id}>
                <p className="font-medium">
                  {invoice.invoiceNumber} - {invoice.status}
                </p>
                <p className="text-[var(--muted)]">
                  {formatPaisa(invoice.totalPaisa, order.currency)} - {formatDate(invoice.invoiceDate)}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-base font-semibold">Payments</h3>
          <div className="mt-2 space-y-2 text-sm">
            {payments.length === 0 ? <p className="text-[var(--muted)]">No payments yet.</p> : null}
            {payments.map((payment) => (
              <div className="rounded-md border border-[var(--border)] p-3" key={payment.id}>
                <p className="font-medium">
                  {formatPaisa(payment.amountPaisa, order.currency)} - {payment.mode}
                </p>
                <p className="text-[var(--muted)]">
                  {formatDate(payment.paymentDate)}
                  {payment.reference ? ` - ${payment.reference}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-base font-semibold">Costs</h3>
          <div className="mt-2 space-y-2 text-sm">
            {costs.length === 0 ? <p className="text-[var(--muted)]">No costs yet.</p> : null}
            {costs.map((cost) => (
              <div className="rounded-md border border-[var(--border)] p-3" key={cost.id}>
                <p className="font-medium">
                  {cost.category} - {cost.status}
                </p>
                <p className="text-[var(--muted)]">{formatPaisa(cost.amountPaisa, order.currency)}</p>
                {canManage && cost.status === "DRAFT" ? (
                  <form action={changeCostComponentStatusAction.bind(null, cost.id, "APPROVED")} className="mt-2">
                    <button className="crm-button crm-button-secondary text-sm" type="submit">
                      Approve cost
                    </button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold">Incentive</h3>
        <div className="mt-2 rounded-md border border-[var(--border)] p-3 text-sm">
          <p className="font-medium">{incentive?.status ?? "NOT_READY"}</p>
          <p className="text-[var(--muted)]">{incentive?.readinessReason ?? "Ready state is recalculated after payment and cost changes."}</p>
          {incentive?.splits.length ? (
            <div className="mt-2 space-y-1">
              {incentive.splits.map((split) => (
                <p key={split.userId}>
                  {split.user.name}: {split.percent}% - {formatPaisa(split.amountPaisa, order.currency)}
                </p>
              ))}
            </div>
          ) : null}
          {canManage && approveAction ? <IncentiveApprovalForm action={approveAction} disabled={incentive?.status !== "READY_FOR_REVIEW"} /> : null}
        </div>
      </div>
    </section>
  );
}
