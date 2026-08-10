import { describe, expect, it } from "vitest";
import {
  executeTenantIsolationMatrix,
  tenantIsolationCategories,
  tenantIsolationDomains,
  tenantIsolationMatrix,
  type TenantIsolationAdapter,
  type TenantIsolationCategory,
  type TenantIsolationDomain
} from "./tenant-adversarial-matrix";

const requiredDomains = [
  "crm",
  "sales-day",
  "pipeline-opportunities",
  "products-proposals",
  "orders-production",
  "finance-incentives",
  "reports",
  "shared-export",
  "workflow"
] as const;

const requiredCategories = [
  "list",
  "direct-id",
  "search",
  "aggregate",
  "create",
  "update",
  "delete",
  "foreign-attachment",
  "nested-include",
  "duplicate-identifier"
] as const;

describe("organization A/B adversarial matrix inventory", () => {
  it("binds every owned domain and isolation category to an executable scenario", () => {
    expect(Object.keys(tenantIsolationMatrix).sort()).toEqual([...requiredDomains].sort());
    for (const domain of requiredDomains) {
      expect(Object.keys(tenantIsolationMatrix[domain]).sort(), domain).toEqual([...requiredCategories].sort());
      for (const category of requiredCategories) {
        expect(tenantIsolationMatrix[domain][category].run, `${domain}:${category}`).toBeTypeOf("function");
      }
    }
  });

  it("executes and records every cell, failing closed when an adapter operation is omitted", async () => {
    const calls: string[] = [];
    const adapters = Object.fromEntries(tenantIsolationDomains.map((domain) => [
      domain,
      Object.fromEntries(tenantIsolationCategories.map((category) => [
        category,
        async () => { calls.push(`${domain}:${category}`); }
      ])) as unknown as TenantIsolationAdapter
    ])) as Record<TenantIsolationDomain, TenantIsolationAdapter>;

    const executions = await executeTenantIsolationMatrix(adapters);

    expect(executions).toHaveLength(requiredDomains.length * requiredCategories.length);
    expect(new Set(executions.map(({ domain, category }) => `${domain}:${category}`))).toEqual(new Set(
      requiredDomains.flatMap((domain) => requiredCategories.map((category) => `${domain}:${category}`))
    ));
    expect(calls.length).toBeGreaterThanOrEqual(80);

    const incomplete = {
      ...adapters,
      crm: { ...adapters.crm, delete: undefined }
    } as unknown as Record<TenantIsolationDomain, TenantIsolationAdapter>;
    await expect(executeTenantIsolationMatrix(incomplete)).rejects.toThrow("Missing executable tenant-isolation scenario: crm:delete");
  });

  it("exports the required dimensions as readonly typed values", () => {
    expect([...tenantIsolationDomains]).toEqual(requiredDomains);
    expect([...tenantIsolationCategories]).toEqual(requiredCategories);
    const category: TenantIsolationCategory = tenantIsolationCategories[0];
    const domain: TenantIsolationDomain = tenantIsolationDomains[0];
    expect(`${domain}:${category}`).toBe("crm:list");
  });

  it("records reviewed reasons and executable equivalents for genuinely inapplicable cells", () => {
    expect(tenantIsolationMatrix.reports.create).toMatchObject({
      kind: "reviewed-na", equivalentOperation: "aggregate"
    });
    expect(tenantIsolationMatrix.workflow["foreign-attachment"]).toMatchObject({ kind: "executable" });
    for (const domain of requiredDomains) {
      for (const category of requiredCategories) {
        const scenario = tenantIsolationMatrix[domain][category];
        if (scenario.kind === "reviewed-na") expect(scenario.reason.trim().length, `${domain}:${category}`).toBeGreaterThan(20);
      }
    }
  });
});
