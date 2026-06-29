import { describe, expect, it, vi } from "vitest";
import { getContactDetail, getCustomer360Timeline, listContacts, listLeadCustomers } from "./queries";

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
        contact: { findMany: vi.fn().mockResolvedValue([]) },
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
        contact: { findMany: vi.fn().mockResolvedValue([]) },
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

  it("lists contacts from the shared CRM data with lead and pipeline context", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "contact_1",
        name: "Anita Rao",
        designation: "Head of Learning Operations",
        email: "anita.rao@example.com",
        phone: "+91 98765 43210",
        isPrimary: true,
        updatedAt: new Date("2026-06-20T10:00:00.000Z"),
        branch: { id: "branch_1", name: "Bengaluru Delivery Office", city: "Bengaluru", region: "Karnataka" },
        leadCustomer: {
          id: "lead_1",
          name: "Acme Learning Pvt Ltd",
          state: "LEAD",
          owner: { id: "user_sales", name: "Sales User", email: "sales@example.com", role: "SALES" },
          _count: { contacts: 2, opportunities: 1 }
        }
      }
    ]);

    const result = await listContacts(
      requester,
      { q: "anita", ownerId: "user_sales", state: "LEAD" },
      {
        contact: { findMany },
        leadCustomer: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
        user: { findMany: vi.fn().mockResolvedValue([]) }
      }
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: "anita", mode: "insensitive" } },
            { designation: { contains: "anita", mode: "insensitive" } },
            { email: { contains: "anita", mode: "insensitive" } },
            { phone: { contains: "anita", mode: "insensitive" } },
            { leadCustomer: { name: { contains: "anita", mode: "insensitive" } } },
            { branch: { name: { contains: "anita", mode: "insensitive" } } }
          ]
        }
      })
    );
    expect(result.records).toHaveLength(1);
    expect(result.records[0].leadCustomer._count.opportunities).toBe(1);
  });

  it("loads a contact detail record with basic lead linkage", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "contact_1",
      leadCustomerId: "lead_1",
      branchId: "branch_1",
      name: "Anita Rao",
      designation: "Head of Learning Operations",
      email: "anita.rao@example.com",
      phone: "+91 98765 43210",
      isPrimary: true,
      notes: "Prefers morning calls.",
      updatedAt: new Date("2026-06-21T10:00:00.000Z"),
      branch: { id: "branch_1", name: "Bengaluru Delivery Office", city: "Bengaluru", region: "Karnataka" },
      leadCustomer: {
        id: "lead_1",
        name: "Acme Learning Pvt Ltd",
        state: "LEAD",
        industry: "Education",
        source: "Referral",
        notes: "Exploring a phased rollout.",
        owner: { id: "user_sales", name: "Sales User", email: "sales@example.com", role: "SALES" },
        branches: [{ id: "branch_1", name: "Bengaluru Delivery Office", city: "Bengaluru", region: "Karnataka" }],
        opportunities: [],
        _count: { branches: 1, contacts: 2, activities: 3, opportunities: 0 }
      },
      activities: []
    });

    const result = await getContactDetail(requester, "contact_1", { contact: { findUnique } });

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "contact_1" }
      })
    );
    expect(result?.leadCustomer.name).toBe("Acme Learning Pvt Ltd");
  });

  it("builds a customer 360 timeline across CRM, My Day, opportunity, order, and finance records", async () => {
    const result = await getCustomer360Timeline(requester, "lead_1", {
      activity: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "activity_1",
            subject: "Discovery call",
            type: "CALL",
            status: "COMPLETED",
            occurredAt: new Date("2026-06-16T10:00:00.000Z"),
            dueAt: null,
            createdAt: new Date("2026-06-16T09:00:00.000Z"),
            owner: { id: "sales_1", name: "Sales User" }
          }
        ])
      },
      salesTask: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "task_1",
            title: "Send revised proposal",
            type: "FOLLOW_UP",
            priority: "HIGH",
            status: "OPEN",
            dueAt: new Date("2026-06-21T09:00:00.000Z"),
            updatedAt: new Date("2026-06-20T12:00:00.000Z"),
            owner: { id: "sales_1", name: "Sales User" }
          }
        ])
      },
      salesTextNote: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "note_1",
            body: "Customer asked for USD pricing.",
            createdAt: new Date("2026-06-17T11:00:00.000Z"),
            owner: { id: "sales_1", name: "Sales User" }
          }
        ])
      },
      salesVoiceNote: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "voice_1",
            summary: "Asked for revised tax handling",
            transcript: null,
            status: "TRANSCRIBED",
            createdAt: new Date("2026-06-17T12:00:00.000Z"),
            owner: { id: "sales_1", name: "Sales User" }
          }
        ])
      },
      opportunity: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "opp_1",
            title: "Enterprise rollout",
            nextFollowUpAt: new Date("2026-06-21T10:00:00.000Z"),
            updatedAt: new Date("2026-06-18T10:00:00.000Z"),
            stage: { name: "Proposal Sent" },
            owner: { id: "sales_1", name: "Sales User" }
          }
        ])
      },
      proposal: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "proposal_1",
            title: "USD quote",
            status: "SENT",
            totalPaisa: 125000,
            currency: "USD",
            updatedAt: new Date("2026-06-18T12:00:00.000Z")
          }
        ])
      },
      order: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "order_1",
            orderNumber: "ORD-001",
            status: "BOOKED",
            totalPaisa: 125000,
            currency: "USD",
            bookedAt: new Date("2026-06-19T09:00:00.000Z"),
            productionWorkItems: [{ id: "work_1", status: "IN_PROGRESS", title: "Build module" }],
            invoices: [{ id: "invoice_1", invoiceNumber: "INV-001", totalPaisa: 125000, status: "ISSUED", invoiceDate: new Date("2026-06-19T10:00:00.000Z") }],
            payments: [{ id: "payment_1", amountPaisa: 50000, paymentDate: new Date("2026-06-20T10:00:00.000Z") }],
            costComponents: [{ id: "cost_1", description: "Voiceover vendor", amountPaisa: 10000, status: "APPROVED", createdAt: new Date("2026-06-20T11:00:00.000Z") }]
          }
        ])
      }
    });

    expect(result.map((item) => item.kind)).toEqual([
      "follow_up",
      "task",
      "cost",
      "payment",
      "invoice",
      "production",
      "order",
      "proposal",
      "opportunity",
      "voice_note",
      "text_note",
      "activity"
    ]);
    expect(result[0]).toMatchObject({
      kind: "follow_up",
      title: "Follow up: Enterprise rollout",
      href: "/opportunities/opp_1"
    });
    expect(result[1]).toMatchObject({
      kind: "task",
      title: "Send revised proposal",
      detail: "FOLLOW_UP | HIGH | OPEN"
    });
    expect(result[0]).toMatchObject({
      actor: "Sales User"
    });
  });
});
