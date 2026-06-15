import { describe, expect, it } from "vitest";
import { parseOrderBookingFormForTest, parseOrderStatusFormForTest, parsePoMetadataFormForTest } from "./actions";

describe("order actions", () => {
  it("parses order booking form data", () => {
    const formData = new FormData();
    formData.set("proposalId", "proposal_accepted");
    formData.set("poNumber", "PO-1001");
    formData.set("deliveryDueAt", "2026-08-15");

    const parsed = parseOrderBookingFormForTest(formData);

    expect(parsed.ok).toBe(true);
    expect(parsed.ok ? parsed.data.proposalId : null).toBe("proposal_accepted");
    expect(parsed.ok ? parsed.data.poNumber : null).toBe("PO-1001");
  });

  it("returns field errors for invalid PO metadata", () => {
    const formData = new FormData();
    formData.set("poFileSizeBytes", "0");

    const parsed = parsePoMetadataFormForTest(formData);

    expect(parsed.ok).toBe(false);
    expect(parsed.ok ? null : parsed.fieldErrors.poFileSizeBytes).toBeDefined();
  });

  it("parses supported order status transitions", () => {
    const formData = new FormData();
    formData.set("status", "IN_PRODUCTION");

    const parsed = parseOrderStatusFormForTest(formData);

    expect(parsed.ok).toBe(true);
    expect(parsed.ok ? parsed.data.status : null).toBe("IN_PRODUCTION");
  });
});
