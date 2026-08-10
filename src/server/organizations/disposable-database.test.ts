import { describe, expect, it } from "vitest";
import { validateDisposableDatabaseUrls } from "./disposable-database";

const owner = "postgresql://owner@127.0.0.1:55460/ecrm_wp4_disposable?schema=public";
const tenant = "postgresql://tenant@127.0.0.1:55460/ecrm_wp4_disposable?schema=public";
const control = "postgresql://control@127.0.0.1:55460/ecrm_wp4_disposable?schema=public";

describe("validateDisposableDatabaseUrls", () => {
  it("requires both explicit test URLs", () => {
    expect(() => validateDisposableDatabaseUrls(undefined, tenant, control)).toThrow("TEST_DATABASE_URL");
    expect(() => validateDisposableDatabaseUrls(owner, undefined, control)).toThrow("TEST_TENANT_DATABASE_URL");
    expect(() => validateDisposableDatabaseUrls(owner, tenant, undefined)).toThrow("TEST_CONTROL_DATABASE_URL");
  });

  it.each([
    [owner.replace("55460", "55461"), tenant, control, "host, port, database, and schema"],
    [owner.replace("wp4_disposable", "production"), tenant.replace("wp4_disposable", "production"), control.replace("wp4_disposable", "production"), "disposable"],
    [owner, owner, control, "different database logins"],
    [owner, tenant.replace("schema=public", "schema=other"), control, "host, port, database, and schema"]
  ])("rejects unsafe URL pairs", (ownerUrl, tenantUrl, controlUrl, message) => {
    expect(() => validateDisposableDatabaseUrls(ownerUrl, tenantUrl, controlUrl)).toThrow(message);
  });

  it("rejects an ordinary application database target", () => {
    expect(() => validateDisposableDatabaseUrls(owner, tenant, control, [owner])).toThrow("ordinary application database");
  });

  it("returns a canonical safe pair", () => {
    expect(validateDisposableDatabaseUrls(owner, tenant, control, [])).toEqual({ ownerUrl: owner, tenantUrl: tenant, controlUrl: control });
  });
});
