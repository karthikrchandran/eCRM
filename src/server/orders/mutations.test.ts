import { describe, expect, it, vi } from "vitest";
import { changeOrderStatus, createOrderFromAcceptedProposal, updateOrderPoMetadata } from "./mutations";

const admin = { id: "user_admin", role: "ADMIN" as const };

const acceptedProposal = {
  id: "proposal_accepted",
  opportunityId: "opp_1",
  currency: "INR",
  subtotalPaisa: 500000,
  gstPaisa: 90000,
  totalPaisa: 590000,
  opportunity: {
    id: "opp_1",
    leadCustomerId: "lead_1",
    branchId: "branch_1",
    ownerId: "user_sales",
    leadCustomer: { id: "lead_1", name: "Acme Learning Pvt Ltd", state: "LEAD" },
    branch: { id: "branch_1", name: "Bengaluru Branch", city: "Bengaluru", region: "Karnataka" },
    owner: { id: "user_sales", name: "Sales User", email: "sales@example.com", role: "SALES" },
    stage: { id: "stage_qualified", name: "Qualified", kind: "OPEN", sortOrder: 20 },
    splits: [{ percent: 100, userId: "user_sales", user: { id: "user_sales", name: "Sales User", email: "sales@example.com", role: "SALES" } }]
  },
  lineItems: [
    {
      id: "line_1",
      productServiceId: "product_elearning",
      productNameSnapshot: "eLearning",
      productCategorySnapshot: "eLearning",
      description: "Five modules",
      quantity: 5,
      unitPricePaisa: 100000,
      gstRateBps: 1800,
      gstOverrideReason: null,
      lineSubtotalPaisa: 500000,
      lineGstPaisa: 90000,
      lineTotalPaisa: 590000,
      sortOrder: 0,
      productService: {
        id: "product_elearning",
        name: "eLearning",
        category: "eLearning",
        active: true,
        defaultProductionTemplateKey: "elearning"
      }
    }
  ],
  pdfAttachments: [{ id: "pdf_1" }],
  createdBy: admin,
  updatedBy: admin
};

function createDatabase({
  existingOrder = null,
  proposal = acceptedProposal
}: {
  existingOrder?: { id: string } | null;
  proposal?: typeof acceptedProposal | null;
} = {}) {
  const tx = {
    order: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: "order_1", orderNumber: "ORD-2026-0001" }),
      findUnique: vi.fn().mockResolvedValue(existingOrder)
    },
    proposal: {
      findFirst: vi.fn().mockResolvedValue(proposal)
    }
  };
  const runTransaction = async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx);
  const database = {
    $transaction: vi.fn(runTransaction)
  };

  return { database: database as unknown as NonNullable<Parameters<typeof createOrderFromAcceptedProposal>[2]>, tx };
}

describe("order mutations", () => {
  it("rejects booking when the proposal is not accepted", async () => {
    const { database } = createDatabase({ proposal: null });

    await expect(createOrderFromAcceptedProposal(admin, { proposalId: "proposal_draft" }, database)).rejects.toThrow(
      "Accepted proposal was not found."
    );
  });

  it("rejects duplicate order booking for the same proposal", async () => {
    const { database } = createDatabase({ existingOrder: { id: "order_existing" } });

    await expect(createOrderFromAcceptedProposal(admin, { proposalId: "proposal_accepted" }, database)).rejects.toThrow(
      "This proposal already has an order."
    );
  });

  it("creates an order with proposal totals, line snapshots, template keys, and owner split snapshots", async () => {
    const { database, tx } = createDatabase();

    await createOrderFromAcceptedProposal(
      admin,
      { deliveryDueAt: new Date("2026-08-15T00:00:00.000Z"), poNumber: "PO-1001", proposalId: "proposal_accepted" },
      database
    );

    expect(database.$transaction).toHaveBeenCalledOnce();
    expect(tx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        branchId: "branch_1",
        currency: "INR",
        deliveryDueAt: new Date("2026-08-15T00:00:00.000Z"),
        gstPaisa: 90000,
        leadCustomerId: "lead_1",
        opportunityId: "opp_1",
        ownerId: "user_sales",
        poNumber: "PO-1001",
        proposalId: "proposal_accepted",
        status: "BOOKED",
        subtotalPaisa: 500000,
        totalPaisa: 590000,
        createdById: "user_admin",
        updatedById: "user_admin"
      })
    });
    expect(tx.order.create.mock.calls[0]?.[0].data.lineItems.create).toEqual([
      expect.objectContaining({
        productServiceId: "product_elearning",
        productNameSnapshot: "eLearning",
        productCategorySnapshot: "eLearning",
        productionTemplateKeySnapshot: "elearning",
        proposalLineItemId: "line_1"
      })
    ]);
    expect(tx.order.create.mock.calls[0]?.[0].data.splitSnapshots.create).toEqual([{ percent: 100, userId: "user_sales" }]);
  });

  it("updates PO metadata without touching commercial fields", async () => {
    const update = vi.fn().mockResolvedValue({ id: "order_1" });

    await updateOrderPoMetadata(
      admin,
      "order_1",
      { poFileSizeBytes: 2048, poNumber: "PO-1001" },
      { order: { update } }
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: "order_1" },
      data: { poFileSizeBytes: 2048, poNumber: "PO-1001", updatedById: "user_admin" }
    });
  });

  it("changes order status", async () => {
    const update = vi.fn().mockResolvedValue({ id: "order_1", status: "IN_PRODUCTION" });

    await changeOrderStatus(admin, "order_1", "IN_PRODUCTION", { order: { update } });

    expect(update).toHaveBeenCalledWith({
      where: { id: "order_1" },
      data: { status: "IN_PRODUCTION", updatedById: "user_admin" }
    });
  });
});
