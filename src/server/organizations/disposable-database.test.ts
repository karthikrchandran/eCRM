import { describe, expect, it } from "vitest";
import { validateDisposableDatabaseUrls } from "./disposable-database";

const owner = "postgresql://owner@127.0.0.1:55460/ecrm_wp4_disposable?schema=public";
const tenant = "postgresql://tenant@127.0.0.1:55460/ecrm_wp4_disposable?schema=public";

describe("validateDisposableDatabaseUrls", () => {
  it("requires both explicit test URLs", () => {
    expect(() => validateDisposableDatabaseUrls(undefined, tenant)).toThrow("TEST_DATABASE_URL");
    expect(() => validateDisposableDatabaseUrls(owner, undefined)).toThrow("TEST_TENANT_DATABASE_URL");
  });

  it.each([
    [owner.replace("55460", "55461"), tenant, "host, port, database, and schema"],
    [owner.replace("wp4_disposable", "production"), tenant.replace("wp4_disposable", "production"), "disposable"],
    [owner, owner, "different database logins"],
    [owner, tenant.replace("schema=public", "schema=other"), "host, port, database, and schema"]
  ])("rejects unsafe URL pairs", (ownerUrl, tenantUrl, message) => {
    expect(() => validateDisposableDatabaseUrls(ownerUrl, tenantUrl)).toThrow(message);
  });

  it("rejects an ordinary application database target", () => {
    expect(() => validateDisposableDatabaseUrls(owner, tenant, [owner])).toThrow("ordinary application database");
  });

  it("returns a canonical safe pair", () => {
    expect(validateDisposableDatabaseUrls(owner, tenant, [])).toEqual({ ownerUrl: owner, tenantUrl: tenant });
  });
});
