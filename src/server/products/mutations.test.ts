import { describe, expect, it, vi } from "vitest";
import { createProductService, setProductServiceActive, updateProductService } from "./mutations";

const admin = { id: "user_admin", role: "ADMIN" as const };
const sales = { id: "user_sales", role: "SALES" as const };

const productInput = {
  name: "Custom eLearning Module",
  code: "ELM-001",
  category: "eLearning",
  description: "Storyboard and build",
  defaultGstRateBps: 1800,
  defaultProductionTemplateKey: "elearning",
  active: true,
  sortOrder: 10
};

describe("product service mutations", () => {
  it("creates product catalog records with Admin audit metadata", async () => {
    const create = vi.fn().mockResolvedValue({ id: "product_1" });

    await createProductService(admin, productInput, {
      productService: { create }
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        ...productInput,
        createdById: "user_admin",
        updatedById: "user_admin"
      }
    });
  });

  it("rejects Sales catalog writes", async () => {
    await expect(
      createProductService(sales, productInput, {
        productService: { create: vi.fn() }
      })
    ).rejects.toThrow("Only Admin can manage products and services.");
  });

  it("updates catalog records without changing historical proposal snapshots", async () => {
    const update = vi.fn().mockResolvedValue({ id: "product_1" });

    await updateProductService(admin, "product_1", { ...productInput, name: "Updated eLearning Module" }, {
      productService: {
        findUnique: vi.fn().mockResolvedValue({ id: "product_1" }),
        update
      }
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: "product_1" },
      data: expect.objectContaining({
        name: "Updated eLearning Module",
        updatedById: "user_admin"
      })
    });
  });

  it("deactivates and reactivates catalog records instead of deleting them", async () => {
    const update = vi.fn().mockResolvedValue({ id: "product_1", active: false });

    await setProductServiceActive(admin, "product_1", false, {
      productService: {
        findUnique: vi.fn().mockResolvedValue({ id: "product_1" }),
        update
      }
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: "product_1" },
      data: { active: false, updatedById: "user_admin" }
    });
  });
});
