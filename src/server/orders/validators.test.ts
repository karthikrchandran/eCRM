import { describe, expect, it } from "vitest";
import { orderBookingInputSchema, orderStatusTransitionSchema, poMetadataInputSchema } from "./validators";

describe("order validators", () => {
  it("normalizes optional booking fields and rejects missing proposal id", () => {
    const parsed = orderBookingInputSchema.safeParse({
      deliveryDueAt: "",
      poDate: "",
      poFileName: "",
      poFileSizeBytes: "",
      poMimeType: "",
      poNumber: "",
      poStorageKey: "",
      proposalId: "proposal_1"
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success ? parsed.data : null).toEqual({ proposalId: "proposal_1" });

    expect(orderBookingInputSchema.safeParse({ proposalId: "" }).success).toBe(false);
  });

  it("normalizes PO metadata without accepting invalid file size", () => {
    const parsed = poMetadataInputSchema.safeParse({
      deliveryDueAt: "2026-08-15",
      poDate: "2026-07-01",
      poFileName: "po.pdf",
      poFileSizeBytes: "2048",
      poMimeType: "application/pdf",
      poNumber: "PO-1001",
      poStorageKey: "orders/po.pdf"
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success ? parsed.data.poFileSizeBytes : null).toBe(2048);
    expect(poMetadataInputSchema.safeParse({ poFileSizeBytes: "0" }).success).toBe(false);
  });

  it("accepts only supported order status transitions", () => {
    expect(orderStatusTransitionSchema.safeParse({ status: "IN_PRODUCTION" }).success).toBe(true);
    expect(orderStatusTransitionSchema.safeParse({ status: "PAID" }).success).toBe(false);
  });
});
