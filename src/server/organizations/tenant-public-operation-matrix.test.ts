import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { tenantIsolationCategories } from "./tenant-adversarial-matrix";
import { tenantPublicOperationMatrix } from "./tenant-public-operation-matrix";

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

  it("executes each unique callback with its model, category, and real export identity", async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    for (const matrix of Object.values(tenantPublicOperationMatrix)) {
      for (const category of tenantIsolationCategories) {
        await matrix[category].run({ invoke });
      }
    }

    expect(invoke).toHaveBeenCalledTimes(380);
    const invocations = invoke.mock.calls.map(([scenario]) =>
      `${scenario.model}:${scenario.category}:${scenario.exportName}`
    );
    expect(new Set(invocations).size).toBe(380);
  });
});
