import Link from "next/link";
import { isSafeExternalUrl } from "@/lib/safe-external-url";
import type { ActionState } from "@/server/products/types";
import { EmptyState, StatusBadge } from "@/components/ui/sales-primitives";
import { ProposalPdfUpload } from "./proposal-pdf-upload";
import { ProposalStatusActions } from "./proposal-status-actions";

type ProposalDetailRecord = {
  id: string;
  opportunityId: string;
  title: string;
  sequenceNumber: number;
  versionLabel: string | null;
  status: string;
  currency: string;
  validUntil: Date | null;
  commercialSummary: string | null;
  assumptions: string | null;
  inclusions: string | null;
  exclusions: string | null;
  paymentTerms: string | null;
  deliveryTimeline: string | null;
  internalNotes: string | null;
  subtotalPaisa: number;
  gstPaisa: number;
  totalPaisa: number;
  order?: { id: string; orderNumber: string } | null;
  opportunity: {
    id: string;
    title: string;
    leadCustomer: { name: string; state: string };
    branch: { name: string; city: string | null; region: string | null } | null;
    owner: { name: string; email: string };
    stage: { name: string; kind: string };
  };
  lineItems: Array<{
    id: string;
    productNameSnapshot: string;
    productCategorySnapshot: string;
    description: string | null;
    quantity: unknown;
    unitPricePaisa: number;
    gstRateBps: number;
    gstOverrideReason: string | null;
    lineSubtotalPaisa: number;
    lineGstPaisa: number;
    lineTotalPaisa: number;
  }>;
  pdfAttachments: Array<{
    id: string;
    originalFileName: string;
    storageProvider: string;
    storageKey: string;
    mimeType: string;
    fileSizeBytes: number;
    canvaDesignUrl: string | null;
    uploadedAt: Date;
    uploadedBy: { name: string; email: string };
  }>;
};

type ProposalDetailProps = {
  proposal: ProposalDetailRecord;
  pdfMetadataAction?: (state: ActionState, formData: FormData) => Promise<ActionState>;
  statusAction?: (formData: FormData) => Promise<void>;
};

function formatPaisa(value: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(value / 100)}`;
}

function formatDate(date: Date | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TextBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase text-[var(--muted)]">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{value || "Not set"}</p>
    </div>
  );
}

export function ProposalDetail({ proposal, pdfMetadataAction, statusAction }: ProposalDetailProps) {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{proposal.title}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Sequence {proposal.sequenceNumber}
            {proposal.versionLabel ? ` - ${proposal.versionLabel}` : ""} - {proposal.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {proposal.order ? (
            <Link className="crm-button crm-button-primary text-sm" href={`/orders/${proposal.order.id}`}>
              View order {proposal.order.orderNumber}
            </Link>
          ) : proposal.status === "ACCEPTED" ? (
            <Link
              className="crm-button crm-button-primary text-sm"
              href={`/opportunities/${proposal.opportunityId}/proposals/${proposal.id}/book-order`}
            >
              Book order
            </Link>
          ) : null}
          <Link
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold"
            href={`/opportunities/${proposal.opportunityId}`}
          >
            Back to opportunity
          </Link>
        </div>
      </header>

      <section className="surface grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Opportunity</p>
          <p className="font-medium">{proposal.opportunity.title}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Lead/customer</p>
          <p className="font-medium">{proposal.opportunity.leadCustomer.name}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Branch</p>
          <p className="font-medium">{proposal.opportunity.branch?.name ?? "Company level"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Owner</p>
          <p className="font-medium">{proposal.opportunity.owner.name}</p>
          <p className="text-xs text-[var(--muted)]">{proposal.opportunity.owner.email}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Stage</p>
          <p className="font-medium">{proposal.opportunity.stage.name}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Status</p>
          <p className="font-medium">{proposal.status}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Valid until</p>
          <p className="font-medium">{formatDate(proposal.validUntil)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Total</p>
          <p className="font-medium">{formatPaisa(proposal.totalPaisa, proposal.currency)}</p>
        </div>
      </section>

      {statusAction ? <ProposalStatusActions action={statusAction} status={proposal.status} /> : null}

      <section className="surface grid gap-4 p-4 md:grid-cols-2">
        <TextBlock label="Commercial summary" value={proposal.commercialSummary} />
        <TextBlock label="Assumptions" value={proposal.assumptions} />
        <TextBlock label="Inclusions" value={proposal.inclusions} />
        <TextBlock label="Exclusions" value={proposal.exclusions} />
        <TextBlock label="Payment terms" value={proposal.paymentTerms} />
        <TextBlock label="Delivery timeline" value={proposal.deliveryTimeline} />
        <TextBlock label="Internal notes" value={proposal.internalNotes} />
      </section>

      <section className="surface overflow-x-auto p-4">
        <h2 className="text-lg font-semibold">Line item snapshots</h2>
        <table className="mt-3 min-w-full text-left text-sm">
          <thead className="text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="py-2 pr-4">Product/service</th>
              <th className="py-2 pr-4">Description</th>
              <th className="py-2 pr-4">Qty</th>
              <th className="py-2 pr-4">Unit</th>
              <th className="py-2 pr-4">GST</th>
              <th className="py-2 pr-4">Subtotal</th>
              <th className="py-2 pr-4">Total</th>
            </tr>
          </thead>
          <tbody>
            {proposal.lineItems.map((line) => (
              <tr className="border-t border-[var(--border)]" key={line.id}>
                <td className="py-3 pr-4">
                  <p className="font-medium">{line.productNameSnapshot}</p>
                  <p className="text-xs text-[var(--muted)]">{line.productCategorySnapshot}</p>
                </td>
                <td className="py-3 pr-4">{line.description || "Not set"}</td>
                <td className="py-3 pr-4">{line.quantity?.toString()}</td>
                <td className="py-3 pr-4">{formatPaisa(line.unitPricePaisa, proposal.currency)}</td>
                <td className="py-3 pr-4">
                  {line.gstRateBps / 100}%
                  {line.gstOverrideReason ? <p className="text-xs text-[var(--muted)]">{line.gstOverrideReason}</p> : null}
                </td>
                <td className="py-3 pr-4">{formatPaisa(line.lineSubtotalPaisa, proposal.currency)}</td>
                <td className="py-3 pr-4 font-semibold">{formatPaisa(line.lineTotalPaisa, proposal.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 grid gap-2 text-sm sm:ml-auto sm:w-80">
          <div className="flex justify-between gap-3">
            <span>Subtotal</span>
            <span>{formatPaisa(proposal.subtotalPaisa, proposal.currency)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>GST</span>
            <span>{formatPaisa(proposal.gstPaisa, proposal.currency)}</span>
          </div>
          <div className="flex justify-between gap-3 border-t border-[var(--border)] pt-2 font-semibold">
            <span>Total</span>
            <span>{formatPaisa(proposal.totalPaisa, proposal.currency)}</span>
          </div>
        </div>
      </section>

      <section className="surface p-4">
        <h2 className="text-lg font-semibold">Proposal documents</h2>
        {proposal.pdfAttachments.length === 0 ? (
          <EmptyState title="No proposal document linked yet." description="Add a PDF or document URL so the proposal can be opened from the CRM." />
        ) : null}
        <div className="mt-3 space-y-3">
          {proposal.pdfAttachments.map((attachment) => {
            const documentUrl = isSafeExternalUrl(attachment.storageKey) ? attachment.storageKey : null;
            const canvaUrl = isSafeExternalUrl(attachment.canvaDesignUrl) ? attachment.canvaDesignUrl : null;

            return (
              <article className="rounded-md border border-[var(--border)] p-3" key={attachment.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">{attachment.originalFileName}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
                      <StatusBadge tone="info">{attachment.storageProvider}</StatusBadge>
                      <span>Added by {attachment.uploadedBy.name}</span>
                      <span>{formatFileSize(attachment.fileSizeBytes)}</span>
                    </div>
                    <p className="mt-2 break-all text-xs text-[var(--muted)]">{attachment.storageKey}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {documentUrl ? (
                      <a className="crm-button crm-button-primary text-sm" href={documentUrl} rel="noreferrer" target="_blank">
                        Open document
                      </a>
                    ) : null}
                    {canvaUrl ? (
                      <a className="crm-button crm-button-secondary text-sm" href={canvaUrl} rel="noreferrer" target="_blank">
                        Open Canva design
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {pdfMetadataAction ? <ProposalPdfUpload action={pdfMetadataAction} /> : null}
      </section>
    </div>
  );
}
