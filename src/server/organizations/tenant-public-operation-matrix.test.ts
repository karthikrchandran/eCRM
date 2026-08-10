import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { tenantIsolationCategories } from "./tenant-adversarial-matrix";
import {
  tenantPublicOperationMatrix,
  resolveTenantPublicEquivalent,
  type TenantPublicOperationContext,
  type TenantPublicOperationOutcome
} from "./tenant-public-operation-matrix";

const excludedTenantModels = new Set([
  "OrganizationMembership",
  "OrganizationSettings",
  "OrganizationBranding",
  "OrganizationInstallation"
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
    }, {})).toEqual({ success: 180, denied: 58, duplicate: 11, "na-equivalent": 131 });

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
      {
        category,
        run: vi.fn(async (scenario) => {
          calls.push(`${scenario.model}:${scenario.category}:${scenario.exportName}`);
          return scenario.expectedOutcome;
        })
      }
    ])) as unknown as TenantPublicOperationContext;
    for (const matrix of Object.values(tenantPublicOperationMatrix)) {
      for (const category of tenantIsolationCategories) {
        const execution = await matrix[category].run(handlers);
        expect(execution).toMatchObject({ category, model: matrix[category].model, outcome: matrix[category].expectedOutcome });
      }
    }

    expect(calls).toHaveLength(380);
    for (const category of tenantIsolationCategories) {
      const expectedCalls = Object.entries(tenantPublicOperationMatrix).reduce((count, [model, matrix]) =>
        count + tenantIsolationCategories.filter((sourceCategory) => {
          const source = matrix[sourceCategory];
          if (source.disposition === "executable") return sourceCategory === category;
          return resolveTenantPublicEquivalent(
            tenantPublicOperationMatrix,
            model,
            sourceCategory
          ).category === category;
        }).length, 0);
      expect(handlers[category].run).toHaveBeenCalledTimes(expectedCalls);
    }
  });

  it("fails closed when a cell is routed to the wrong category handler or reports the wrong semantic outcome", async () => {
    const create = tenantPublicOperationMatrix.LeadCustomer.create;
    const wrongCategory = { list: { category: "list", run: vi.fn().mockResolvedValue("success") } } as unknown as TenantPublicOperationContext;
    await expect(create.run(wrongCategory)).rejects.toThrow("Missing create tenant-isolation handler");

    const handlers = Object.fromEntries(tenantIsolationCategories.map((category) => [
      category,
      { category, run: vi.fn().mockResolvedValue("success" satisfies TenantPublicOperationOutcome) }
    ])) as unknown as TenantPublicOperationContext;
    handlers.create = { category: "create", run: vi.fn().mockResolvedValue("denied") };
    await expect(create.run(handlers)).rejects.toThrow("expected success but observed denied");

    handlers.create = handlers.list as unknown as TenantPublicOperationContext["create"];
    await expect(create.run(handlers)).rejects.toThrow("Create handler is bound to list");
  });

  it("executes the named executable equivalent and rejects cyclic N/A graphs", async () => {
    const calls: string[] = [];
    const handlers = Object.fromEntries(tenantIsolationCategories.map((category) => [
      category,
      { category, run: vi.fn(async (scenario) => {
        calls.push(`${scenario.category}:${scenario.exportName}`);
        return scenario.expectedOutcome;
      }) }
    ])) as unknown as TenantPublicOperationContext;

    const execution = await tenantPublicOperationMatrix.SharedBusinessRecord.delete.run(handlers);
    expect(execution.outcome).toBe("na-equivalent");
    expect(calls).toEqual(["direct-id:getSharedRecord"]);

    expect(() => resolveTenantPublicEquivalent({
      Example: {
        list: { disposition: "reviewed-na", equivalentCategory: "search" },
        search: { disposition: "reviewed-na", equivalentCategory: "list" }
      }
    }, "Example", "list")).toThrow("Cyclic tenant-isolation N/A equivalent");
  });
});
