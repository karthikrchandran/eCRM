import { describe, expect, it } from "vitest";
import { tenantIsolationMatrix } from "./tenant-adversarial-matrix";

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
  it("visibly enumerates every owned domain and isolation category", () => {
    expect(Object.keys(tenantIsolationMatrix).sort()).toEqual([...requiredDomains].sort());
    for (const domain of requiredDomains) {
      expect([...tenantIsolationMatrix[domain]].sort(), domain).toEqual([...requiredCategories].sort());
    }
  });
});
