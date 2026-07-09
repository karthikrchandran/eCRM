import { describe, expect, it, vi } from "vitest";
import { listIncentives } from "./incentives-queries";

const admin = { id: "admin", role: "ADMIN" as const };

describe("incentives queries", () => {
  it("applies owner, status, and quarter filters", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    await listIncentives(
      admin,
      { ownerId: "sales_1", status: "READY_FOR_REVIEW", financialYear: 2026, quarter: 1 },
      {
        incentive: { findMany }
      }
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "READY_FOR_REVIEW",
          order: {
            bookedAt: {
              gte: new Date("2026-01-01T00:00:00.000Z"),
              lte: new Date("2026-03-31T23:59:59.999Z")
            },
            ownerId: "sales_1"
          }
        }
      })
    );
  });
});
