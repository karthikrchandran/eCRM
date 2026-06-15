import { describe, expect, test, vi } from "vitest";
import { getOrderFinanceSummary } from "./queries";

const admin = { id: "admin", role: "ADMIN" as const };

describe("finance queries", () => {
  test("loads order finance summary with finance history and incentive splits", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "order_1", invoices: [], payments: [], costComponents: [], incentive: null });

    const summary = await getOrderFinanceSummary(admin, "order_1", { order: { findUnique } });

    expect(summary).toEqual({ id: "order_1", invoices: [], payments: [], costComponents: [], incentive: null });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "order_1" },
      include: expect.objectContaining({
        costComponents: expect.any(Object),
        incentive: expect.any(Object),
        invoices: expect.any(Object),
        payments: expect.any(Object)
      })
    });
  });
});
