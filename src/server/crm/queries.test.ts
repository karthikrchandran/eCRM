import { describe, expect, it, vi } from "vitest";
import { listLeadCustomers } from "./queries";

const requester = {
  id: "user_sales",
  name: "Sales User",
  email: "sales@example.com",
  role: "SALES" as const,
  active: true
};

describe("crm queries", () => {
  it("does not restrict Sales visibility to owned leads", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    await listLeadCustomers(
      requester,
      {},
      {
        leadCustomer: {
          findMany,
          count: vi.fn().mockResolvedValue(0)
        },
        user: {
          findMany: vi.fn().mockResolvedValue([])
        }
      }
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {}
      })
    );
  });

  it("applies explicit owner filters only when the user asks for them", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    await listLeadCustomers(
      requester,
      { ownerId: "user_admin", state: "LEAD", q: "acme" },
      {
        leadCustomer: {
          findMany,
          count: vi.fn().mockResolvedValue(0)
        },
        user: {
          findMany: vi.fn().mockResolvedValue([])
        }
      }
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ownerId: "user_admin",
          state: "LEAD",
          OR: [
            { name: { contains: "acme", mode: "insensitive" } },
            { industry: { contains: "acme", mode: "insensitive" } },
            { source: { contains: "acme", mode: "insensitive" } },
            { contacts: { some: { name: { contains: "acme", mode: "insensitive" } } } },
            { branches: { some: { name: { contains: "acme", mode: "insensitive" } } } }
          ]
        }
      })
    );
  });
});
