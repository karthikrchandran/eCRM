import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { tenantIsolationCategories } from "./tenant-adversarial-matrix";
import {
  tenantPublicOperationMatrix,
  type TenantPublicOperationContext,
  type TenantPublicOperationOutcome
} from "./tenant-public-operation-matrix";

const excludedTenantModels = new Set([
  "OrganizationMembership",
  "OrganizationSettings",
  "OrganizationBranding"
]);

const ownedModels = Prisma.dmmf.datamodel.models
  .filter((model) => model.fields.some((field) => field.name === "organizationId") && !excludedTenantModels.has(model.name))
  .map((model) => model.name);

describe("public tenant isolation operation matrix", () => {
  it("explicitly binds every owned model and category to an exported operation", () => {
    expect(Object.keys(tenantPublicOperationMatrix)).toHaveLength(38);
    expect(new Set(Object.keys(tenantPublicOperationMatrix))).toEqual(new Set(ownedModels));

    const scenarios = Object.values(tenantPublicOperationMatrix).flatMap((model) =>
      tenantIsolationCategories.map((category) => model[category])
    );
    expect(scenarios).toHaveLength(380);
    expect(new Set(scenarios.map((scenario) => scenario.run)).size).toBe(380);
    expect(scenarios.every((scenario) => typeof scenario.operation === "function")).toBe(true);
    expect(new Set(scenarios.map((scenario) => scenario.exportName)).size).toBe(82);
    expect(scenarios.reduce<Record<string, number>>((counts, scenario) => {
      counts[scenario.expectedOutcome] = (counts[scenario.expectedOutcome] ?? 0) + 1;
      return counts;
    }, {})).toEqual({ success: 183, denied: 59, duplicate: 12, "na-equivalent": 126 });

    for (const [modelName, matrix] of Object.entries(tenantPublicOperationMatrix)) {
      expect(Object.keys(matrix)).toEqual(expect.arrayContaining([...tenantIsolationCategories]));
      expect(new Set(Object.values(matrix).map((scenario) => scenario.exportName)).size, modelName).toBeGreaterThan(1);
      for (const category of tenantIsolationCategories) {
        const scenario = matrix[category];
        expect(scenario.model).toBe(modelName);
        expect(scenario.category).toBe(category);
        if (scenario.disposition === "reviewed-na") {
          expect(scenario.reason?.length ?? 0).toBeGreaterThan(24);
          expect(tenantIsolationCategories).toContain(scenario.equivalentCategory);
        }
      }
    }
  });

  it("executes each unique callback through its category-specific handler and records the asserted outcome", async () => {
    const calls: string[] = [];
    const handlers = Object.fromEntries(tenantIsolationCategories.map((category) => [
      category,
      vi.fn(async (scenario) => {
        calls.push(`${scenario.model}:${scenario.category}:${scenario.exportName}`);
        return scenario.expectedOutcome;
      })
    ])) as unknown as TenantPublicOperationContext;
    for (const matrix of Object.values(tenantPublicOperationMatrix)) {
      for (const category of tenantIsolationCategories) {
        const execution = await matrix[category].run(handlers);
        expect(execution).toMatchObject({ category, model: matrix[category].model, outcome: matrix[category].expectedOutcome });
      }
    }

    expect(calls).toHaveLength(380);
    expect(new Set(calls).size).toBe(380);
    for (const category of tenantIsolationCategories) {
      expect(handlers[category]).toHaveBeenCalledTimes(38);
    }
  });

  it("fails closed when a cell is routed to the wrong category handler or reports the wrong semantic outcome", async () => {
    const create = tenantPublicOperationMatrix.LeadCustomer.create;
    const wrongCategory = { list: vi.fn().mockResolvedValue("success") } as unknown as TenantPublicOperationContext;
    await expect(create.run(wrongCategory)).rejects.toThrow("Missing create tenant-isolation handler");

    const handlers = Object.fromEntries(tenantIsolationCategories.map((category) => [
      category,
      vi.fn().mockResolvedValue("success" satisfies TenantPublicOperationOutcome)
    ])) as unknown as TenantPublicOperationContext;
    handlers.create = vi.fn().mockResolvedValue("denied");
    await expect(create.run(handlers)).rejects.toThrow("expected success but observed denied");
  });
});
