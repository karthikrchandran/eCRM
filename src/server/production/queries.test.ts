import { describe, expect, it, vi } from "vitest";
import { getProductionWorkItemDetail, listProductionTemplateConfig, listProductionWorkItems } from "./queries";

const sales = { id: "user_sales", role: "SALES" as const };

describe("production queries", () => {
  it("lists production work items with filters", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "work_item_1" }]);

    await listProductionWorkItems(sales, { assignedToId: "user_sales", status: "IN_PROGRESS" }, {
      productionWorkItem: { findMany, findUnique: vi.fn() }
    });

    expect(findMany).toHaveBeenCalledWith({
      where: { assignedToId: "user_sales", status: "IN_PROGRESS" },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
      include: expect.any(Object)
    });
  });

  it("loads production work item detail", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "work_item_1" });

    await getProductionWorkItemDetail(sales, "work_item_1", {
      productionWorkItem: { findMany: vi.fn(), findUnique }
    });

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "work_item_1" },
      include: expect.any(Object)
    });
  });

  it("allows only admins to load production template configuration", async () => {
    await expect(
      listProductionTemplateConfig(sales, {
        productionWorkItem: { findMany: vi.fn(), findUnique: vi.fn() },
        productionTemplate: { findMany: vi.fn() },
        productService: { findMany: vi.fn() }
      })
    ).rejects.toThrow("permission");

    const findTemplates = vi.fn().mockResolvedValue([{ id: "template_1", stages: [] }]);
    const findProducts = vi.fn().mockResolvedValue([{ id: "product_1", name: "VR Labs" }]);

    await listProductionTemplateConfig(
      { id: "user_admin", role: "ADMIN" },
      {
        productionWorkItem: { findMany: vi.fn(), findUnique: vi.fn() },
        productionTemplate: { findMany: findTemplates },
        productService: { findMany: findProducts }
      }
    );

    expect(findTemplates).toHaveBeenCalledWith({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { stages: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } }
    });
    expect(findProducts).toHaveBeenCalled();
  });
});
