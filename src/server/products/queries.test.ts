import { describe, expect, it, vi } from "vitest";
import { listActiveProductServices, listProductServicesForAdmin } from "./queries";

const admin = { id: "user_admin", role: "ADMIN" as const };
const sales = { id: "user_sales", role: "SALES" as const };

describe("product service queries", () => {
  it("lets Sales read active catalog items for proposal creation", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "product_1", name: "Custom eLearning Module" }]);

    await listActiveProductServices(sales, {
      productService: { findMany }
    });

    expect(findMany).toHaveBeenCalledWith({
      where: { active: true },
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
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: expect.any(Object)
    });
  });
});
