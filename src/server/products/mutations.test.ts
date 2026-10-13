import { describe, expect, it, vi } from "vitest";
import { createProductService, setProductServiceActive, updateProductService } from "./mutations";

const admin = { id: "user_admin", organizationId: "org_test", role: "ADMIN" as const };
const sales = { id: "user_sales", organizationId: "org_test", role: "SALES" as const };

const productInput = {
  name: "Custom eLearning Module",
  code: "ELM-001",
  category: "eLearning",
  description: "Storyboard and build",
  defaultGstRateBps: 1800,
  defaultProductionTemplateKey: "elearning",
  productionStages: [{ stageId: "stage_script", sortOrder: 10 }],
  active: true,
  sortOrder: 10
};

const libraryStage = {
  id: "stage_script",
  key: "script",
  name: "Script",
  description: "Write the script",
  required: true,
  defaultDurationDays: 2
};

function productMutationDb(overrides: {
  productCreate?: ReturnType<typeof vi.fn>;
  productFindFirst?: ReturnType<typeof vi.fn>;
  productUpdate?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    productService: {
      create: overrides.productCreate ?? vi.fn().mockResolvedValue({ id: "product_1" }),
      findFirst: overrides.productFindFirst ?? vi.fn().mockResolvedValue({ id: "product_1", defaultProductionTemplateKey: "product_product_1" }),
      update: overrides.productUpdate ?? vi.fn().mockResolvedValue({ id: "product_1" })
    },
    productionTemplate: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      upsert: vi.fn().mockResolvedValue({ id: "template_product_1" })
    },
    productionTemplateStage: {
      create: vi.fn().mockResolvedValue({ id: "template_stage_1" }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([libraryStage])
    }
  };
}

describe("product service mutations", () => {
  it("creates product catalog records with Admin audit metadata", async () => {
    const create = vi.fn().mockResolvedValue({ id: "product_1" });
    const database = productMutationDb({ productCreate: create });

    await createProductService(admin, productInput, database as never);

    expect(create).toHaveBeenCalledWith({
      data: {
        organizationId: "org_test",
        name: "Custom eLearning Module",
        code: "ELM-001",
        category: "eLearning",
        description: "Storyboard and build",
        defaultGstRateBps: 1800,
        defaultProductionTemplateKey: null,
        active: true,
        sortOrder: 10,
        createdById: "user_admin",
        updatedById: "user_admin"
      }
    });
    expect(database.productionTemplate.upsert).toHaveBeenCalledWith({
      where: { organizationId_key: { organizationId: "org_test", key: "product_product_1" } },
      create: expect.objectContaining({ key: "product_product_1", name: "Custom eLearning Module production flow" }),
      update: expect.objectContaining({ name: "Custom eLearning Module production flow", active: true })
    });
    expect(database.productionTemplateStage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org_test",
        templateId: "template_product_1",
        key: "script",
        name: "Script",
        sortOrder: 10
      })
    });
  });

  it("rejects Sales catalog writes", async () => {
    await expect(
      createProductService(sales, productInput, {
        productService: { create: vi.fn(), update: vi.fn() },
        productionTemplate: { deleteMany: vi.fn(), upsert: vi.fn() },
        productionTemplateStage: { create: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() }
      } as never)
    ).rejects.toThrow("Only Admin can manage products and services.");
  });

  it("updates catalog records without changing historical proposal snapshots", async () => {
    const update = vi.fn().mockResolvedValue({ id: "product_1" });
    const database = productMutationDb({ productUpdate: update });

    await updateProductService(admin, "product_1", { ...productInput, name: "Updated eLearning Module" }, database as never);

    expect(update).toHaveBeenCalledWith({
      where: { id: "product_1" },
      data: expect.objectContaining({
        name: "Updated eLearning Module",
        updatedById: "user_admin"
      })
    });
    expect(database.productionTemplateStage.deleteMany).toHaveBeenCalledWith({
      where: { organizationId: "org_test", templateId: "template_product_1" }
    });
  });

  it("deactivates and reactivates catalog records instead of deleting them", async () => {
    const update = vi.fn().mockResolvedValue({ id: "product_1", active: false });
    const database = productMutationDb({ productUpdate: update });

    await setProductServiceActive(admin, "product_1", false, database as never);

    expect(update).toHaveBeenCalledWith({
      where: { id: "product_1" },
      data: { active: false, updatedById: "user_admin" }
    });
  });
});
