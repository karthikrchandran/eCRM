import { describe, expect, it } from "vitest";

import { buildVersionLedgerEntry, toVersionedSharedRecord } from "./versioning";

describe("shared record versioning", () => {
  it("maps a current shared record into a version ledger entry", () => {
    const result = buildVersionLedgerEntry({
      recordId: "rec_1",
      versionNumber: 3,
      entityType: "CONTACT",
      sourceApp: "ecrm",
      changeType: "UPDATE",
      snapshot: { id: "rec_1", displayName: "Ada Lovelace" },
      baseVersion: 2,
      idempotencyKey: "idem-123"
    });

    expect(result.recordId).toBe("rec_1");
    expect(result.versionNumber).toBe(3);
    expect(result.entityType).toBe("CONTACT");
  });

  it("creates a versioned projection from a current shared record", () => {
    const result = toVersionedSharedRecord({
      id: "rec_1",
      headVersion: 3,
      displayName: "Ada Lovelace"
    });

    expect(result.headVersion).toBe(3);
    expect(result.displayName).toBe("Ada Lovelace");
  });
});
