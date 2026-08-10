import { afterEach, describe, expect, it, vi } from "vitest";

import { createTenantPrismaClient } from "./tenant-db";

describe("createTenantPrismaClient", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(["", "   "])("fails closed without a tenant database URL (%s)", (databaseUrl) => {
    const createClient = vi.fn();

    expect(() => createTenantPrismaClient(databaseUrl, createClient)).toThrow(
      "TENANT_DATABASE_URL is required for tenant business data access."
    );
    expect(createClient).not.toHaveBeenCalled();
  });

  it("fails closed when TENANT_DATABASE_URL is absent", () => {
    vi.stubEnv("TENANT_DATABASE_URL", "");
    const createClient = vi.fn();
    expect(() => createTenantPrismaClient(undefined, createClient)).toThrow(
      "TENANT_DATABASE_URL is required for tenant business data access."
    );
    expect(createClient).not.toHaveBeenCalled();
  });

  it("constructs the tenant client from TENANT_DATABASE_URL without falling back", () => {
    const client = { $transaction: vi.fn() };
    const createClient = vi.fn().mockReturnValue(client);
    const tenantUrl = "postgresql://runtime@tenant-db/ecrm?schema=public";

    expect(createTenantPrismaClient(tenantUrl, createClient)).toBe(client);
    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({ datasourceUrl: tenantUrl })
    );
  });
});
