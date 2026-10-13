import { describe, expect, it, vi } from "vitest";
import { getProductStageSetupForAdmin, listActiveProductServices, listProductServicesForAdmin } from "./queries";

const admin = { id: "user_admin", organizationId: "org_test", role: "ADMIN" as const };
const sales = { id: "user_sales", organizationId: "org_test", role: "SALES" as const };

describe("product service queries", () => {
  it("lets Sales read active catalog items for proposal creation", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "product_1", name: "Custom eLearning Module" }]);

    await listActiveProductServices(sales, {
      productService: { findMany }
    });

    expect(findMany).toHaveBeenCalledWith({
      where: { organizationId: "org_test", active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: expect.any(Object)
    });
  });

  it("lets Admin see active and inactive catalog records", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    await listProductServicesForAdmin(admin, {
      productService: { findMany }
    });

    expect(findMany).toHaveBeenCalledWith({
      where: { organizationId: "org_test" },
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: expect.any(Object)
    });
  });

  it("maps a product production flow back to stage library selections", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({
        stages: [
          { id: "stage_script", key: "script", name: "Script", description: null, defaultDurationDays: 2, required: true, sortOrder: 10 },
          { id: "stage_edit", key: "video_edit", name: "Video edit", description: null, defaultDurationDays: 3, required: true, sortOrder: 20 }
        ]
      })
      .mockResolvedValueOnce({
        stages: [
          { id: "product_stage_edit", key: "video_edit", name: "Video edit", description: null, defaultDurationDays: 3, required: true, sortOrder: 10 }
        ]
      });

    const setup = await getProductStageSetupForAdmin(admin, "product_product_1", {
      productService: { findMany: vi.fn() },
      productionTemplate: { findFirst }
    });

    expect(findFirst).toHaveBeenNthCalledWith(1, {
      where: { organizationId: "org_test", key: "default" },
      select: {
        stages: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: expect.any(Object)
        }
      }
    });
    expect(setup.selectedStages).toEqual([{ stageId: "stage_edit", sortOrder: 10 }]);
  });
});
