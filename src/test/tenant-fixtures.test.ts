import { describe, expect, expectTypeOf, it } from "vitest";

import { tenantFixture, type TenantFixture } from "./tenant-fixtures";

describe("tenantFixture", () => {
  it("creates stable, distinct tenant-owned identifiers", () => {
    const alpha = tenantFixture("alpha");
    const alphaAgain = tenantFixture("alpha");
    const beta = tenantFixture("beta");

    expect(alphaAgain).toEqual(alpha);
    expect(alpha.organizationId).not.toBe(beta.organizationId);
    expect(alpha.leadName).toBe(beta.leadName);
  });

  it("exposes immutable fixture properties", () => {
    expectTypeOf({} as TenantFixture).toEqualTypeOf({} as {
      readonly organizationId: string;
      readonly leadName: string;
      readonly contactEmail: string;
    });
  });
});
