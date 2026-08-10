import { describe, expect, it, vi } from "vitest";
import { listRepPerformanceSummaries } from "./rep-performance-queries";

const admin = { id: "admin", email: "admin@example.com", name: "Admin User", organizationId: "org_test", role: "ADMIN" as const };
const sales = { id: "sales", email: "sales@example.com", name: "Sales User", organizationId: "org_test", role: "SALES" as const };

const repPriya = { id: "rep_priya", name: "Priya Menon", email: "priya@example.com" };
const repArun = { id: "rep_arun", name: "Arun Kumar", email: "arun@example.com" };

function createDatabase() {
  return {
    user: {
      findMany: vi.fn().mockResolvedValue([repPriya, repArun])
    },
    order: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "order_1",
          ownerId: "rep_priya",
          status: "DELIVERED",
          totalPaisa: 10000000,
          invoices: [{ totalPaisa: 10000000 }],
          payments: [{ amountPaisa: 6000000 }]
        },
        {
          id: "order_2",
          ownerId: "rep_arun",
          status: "BOOKED",
          totalPaisa: 5000000,
          invoices: [],
          payments: []
        }
      ])
    },
    salesTarget: {
      findMany: vi.fn().mockResolvedValue([
        { ownerId: "rep_priya", targetValueInr: "120000" },
        { ownerId: "rep_arun", targetValueInr: "80000" }
      ])
    },
    incentive: {
      findMany: vi.fn().mockResolvedValue([
        { payableAmountPaisa: 30000, order: { ownerId: "rep_priya" } },
        { payableAmountPaisa: 10000, order: { ownerId: "rep_arun" } }
      ])
    }
  };
}

describe("listRepPerformanceSummaries", () => {
  it("returns one summary row per active sales rep", async () => {
    const db = createDatabase();
    const result = await listRepPerformanceSummaries(admin, {}, db);

    expect(result).toHaveLength(2);
    expect(result[0].rep.name).toBe("Priya Menon");
    expect(result[1].rep.name).toBe("Arun Kumar");
  });

  it("aggregates booked, collected, and pending per rep correctly", async () => {
    const db = createDatabase();
    const result = await listRepPerformanceSummaries(admin, {}, db);

    const priya = result[0];
    expect(priya.bookedPaisa).toBe(10000000);
    expect(priya.collectedPaisa).toBe(6000000);
    expect(priya.pendingReceivablePaisa).toBe(4000000);
    expect(priya.orderCount).toBe(1);

    const arun = result[1];
    expect(arun.bookedPaisa).toBe(5000000);
    expect(arun.collectedPaisa).toBe(0);
    expect(arun.pendingReceivablePaisa).toBe(5000000);
  });

  it("converts targetValueInr (Decimal) to paisa correctly", async () => {
    const db = createDatabase();
    const result = await listRepPerformanceSummaries(admin, {}, db);

    expect(result[0].targetPaisa).toBe(12000000); // 120000 INR * 100
    expect(result[1].targetPaisa).toBe(8000000); // 80000 INR * 100
  });

  it("sums incentive payable per rep", async () => {
    const db = createDatabase();
    const result = await listRepPerformanceSummaries(admin, {}, db);

    expect(result[0].incentivePayablePaisa).toBe(30000);
    expect(result[1].incentivePayablePaisa).toBe(10000);
  });

  it("applies bookedAt date range filter when financialYear and quarter are provided", async () => {
    const db = createDatabase();
    await listRepPerformanceSummaries(admin, { financialYear: 2026, quarter: 1 }, db);

    expect(db.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          bookedAt: {
            gte: new Date("2026-01-01T00:00:00.000Z"),
            lte: new Date("2026-03-31T23:59:59.999Z")
          }
        })
      })
    );

    expect(db.salesTarget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { financialYear: 2026, organizationId: "org_test", quarter: 1 }
      })
    );
  });

  it("excludes cancelled orders from the query", async () => {
    const db = createDatabase();
    await listRepPerformanceSummaries(admin, {}, db);

    expect(db.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { not: "CANCELLED" } })
      })
    );
  });

  it("returns zero values for reps with no orders or targets", async () => {
    const db = createDatabase();
    db.order.findMany.mockResolvedValue([]);
    db.salesTarget.findMany.mockResolvedValue([]);
    db.incentive.findMany.mockResolvedValue([]);

    const result = await listRepPerformanceSummaries(admin, {}, db);

    expect(result[0].bookedPaisa).toBe(0);
    expect(result[0].targetPaisa).toBe(0);
    expect(result[0].incentivePayablePaisa).toBe(0);
    expect(result[0].orderCount).toBe(0);
  });

  it("throws when a non-admin calls it", async () => {
    const db = createDatabase();
    await expect(listRepPerformanceSummaries(sales, {}, db)).rejects.toThrow();
  });
});
