import { describe, expect, it } from "vitest";

import { tenantFixture } from "./tenant-fixtures";

describe("tenantFixture", () => {
  it("creates stable, distinct tenant-owned identifiers", () => {
    const alpha = tenantFixture("alpha");
    const beta = tenantFixture("beta");

    expect(alpha.organizationId).not.toBe(beta.organizationId);
    expect(alpha.leadName).toBe(beta.leadName);
  });
});
