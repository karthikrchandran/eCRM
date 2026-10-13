import { describe, expect, it, vi } from "vitest";
import { getProductionWorkItemDetail, listProductionTemplateConfig, listProductionWorkItems } from "./queries";

const sales = { id: "user_sales", organizationId: "org_test", role: "SALES" as const };

describe("production queries", () => {
  it("lists production work items with filters", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "work_item_1" }]);

    await listProductionWorkItems(sales, { assignedToId: "user_sales", status: "IN_PROGRESS" }, {
      productionWorkItem: { findMany, findFirst: vi.fn() }
    });

    expect(findMany).toHaveBeenCalledWith({
      where: { assignedToId: "user_sales", organizationId: "org_test", status: "IN_PROGRESS" },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
      include: expect.any(Object)
    });
  });

  it("loads production work item detail", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "work_item_1" });

    await getProductionWorkItemDetail(sales, "work_item_1", {
      productionWorkItem: { findMany: vi.fn(), findFirst }
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "work_item_1", organizationId: "org_test" },
      include: expect.any(Object)
    });
  });

  it("allows only admins to load production template configuration", async () => {
    await expect(
      listProductionTemplateConfig(sales, {
        productionWorkItem: { findMany: vi.fn(), findFirst: vi.fn() },
        productionTemplate: { findMany: vi.fn() },
        productService: { findMany: vi.fn() }
      })
    ).rejects.toThrow("permission");

    const findTemplates = vi.fn().mockResolvedValue([{ id: "template_1", stages: [] }]);
    const findProducts = vi.fn().mockResolvedValue([{ id: "product_1", name: "VR Labs" }]);

    await listProductionTemplateConfig(
      { id: "user_admin", organizationId: "org_test", role: "ADMIN" },
      {
        productionWorkItem: { findMany: vi.fn(), findFirst: vi.fn() },
        productionTemplate: { findMany: findTemplates },
        productService: { findMany: findProducts }
      }
    );

    expect(findTemplates).toHaveBeenCalledWith({
      where: { organizationId: "org_test", key: "default" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { stages: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } }
    });
    expect(findProducts).toHaveBeenCalled();
  });

  it("creates a default product stages container when configuration is empty", async () => {
    const findTemplates = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "template_default", key: "default", name: "Product stages", stages: [] }]);
    const upsert = vi.fn().mockResolvedValue({ id: "template_default" });
    const findProducts = vi.fn().mockResolvedValue([{ id: "product_1", name: "VR Labs" }]);

    const result = await listProductionTemplateConfig(
      { id: "user_admin", organizationId: "org_test", role: "ADMIN" },
      {
        productionWorkItem: { findMany: vi.fn(), findFirst: vi.fn() },
        productionTemplate: { findMany: findTemplates, upsert },
        productService: { findMany: findProducts }
      }
    );

    expect(upsert).toHaveBeenCalledWith({
      where: { organizationId_key: { organizationId: "org_test", key: "default" } },
      create: {
        organizationId: "org_test",
        key: "default",
        name: "Product stages",
        description: "Default production stages for products.",
        active: true,
        sortOrder: 0
      },
      update: { active: true, name: "Product stages" }
    });
    expect(findTemplates).toHaveBeenCalledTimes(2);
    expect(result.templates).toEqual([{ id: "template_default", key: "default", name: "Product stages", stages: [] }]);
  });

  it("loads the default stage library instead of product-specific production flows", async () => {
    const findTemplates = vi.fn().mockResolvedValue([
      { id: "template_default", key: "default", name: "Product stages", stages: [{ id: "stage_script", name: "Script" }] }
    ]);
    const findProducts = vi.fn().mockResolvedValue([{ id: "product_1", name: "Training Video" }]);

    const result = await listProductionTemplateConfig(
      { id: "user_admin", organizationId: "org_test", role: "ADMIN" },
      {
        productionWorkItem: { findMany: vi.fn(), findFirst: vi.fn() },
        productionTemplate: { findMany: findTemplates },
        productService: { findMany: findProducts }
      }
    );

    expect(findTemplates).toHaveBeenCalledWith({
      where: { organizationId: "org_test", key: "default" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { stages: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } }
    });
    expect(result.templates[0]?.key).toBe("default");
  });
});
