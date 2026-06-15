import { describe, expect, it, vi } from "vitest";
import { getProductionWorkItemDetail, listProductionWorkItems } from "./queries";

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
});
