import { describe, expect, it, vi } from "vitest";
import {
  completeActivity,
  createActivity,
  createBranch,
  createContact,
  createLeadCustomer,
  reassignLeadOwner,
  updateContact
} from "./mutations";

const actor = { id: "user_sales", organizationId: "org_test", role: "SALES" as const };

describe("crm mutations", () => {
  it("validates owners through the tenant transaction guard when available", async () => {
    const query = vi.fn().mockResolvedValue([{ allowed: true }]);
    const userLookup = vi.fn();
    const create = vi.fn().mockResolvedValue({ id: "lead_1" });

    await createLeadCustomer(actor, {
      name: "Guarded lead", state: "LEAD", ownerId: "user_sales"
    }, {
      $queryRaw: query,
      leadCustomer: { create },
      user: { findFirst: userLookup }
    } as never);

    expect(query).toHaveBeenCalledOnce();
    expect(userLookup).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledOnce();
  });

  it("creates a lead/customer with created and updated actor metadata", async () => {
    const create = vi.fn().mockResolvedValue({ id: "lead_1" });

    await createLeadCustomer(
      actor,
      {
        name: "Acme Learning Pvt Ltd",
        state: "LEAD",
        ownerId: "user_sales",
        industry: "Education",
        source: "Referral"
      },
      {
        $queryRaw: vi.fn().mockResolvedValue([{ allowed: true }]),
        leadCustomer: { create },
      }
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        organizationId: "org_test",
        name: "Acme Learning Pvt Ltd",
        state: "LEAD",
        ownerId: "user_sales",
        industry: "Education",
        source: "Referral",
        notes: undefined,
        createdById: "user_sales",
        updatedById: "user_sales"
      }
    });
  });

  it("creates child records under an existing lead/customer", async () => {
    const branchCreate = vi.fn().mockResolvedValue({ id: "branch_1" });
    const contactCreate = vi.fn().mockResolvedValue({ id: "contact_1" });
    const findLead = vi.fn().mockResolvedValue({ id: "lead_1" });

    await createBranch(
      actor,
      { leadCustomerId: "lead_1", name: "Bengaluru Branch", country: "India" },
      {
        leadCustomer: { findUnique: findLead },
        branch: { create: branchCreate }
      }
    );

    await createContact(
      actor,
      {
        leadCustomerId: "lead_1",
        branchId: "branch_1",
        name: "Anita Rao",
        email: "anita@example.com",
        isPrimary: true
      },
      {
        leadCustomer: { findUnique: findLead },
        branch: { findFirst: vi.fn().mockResolvedValue({ id: "branch_1" }) },
        contact: { create: contactCreate }
      }
    );

    expect(branchCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ leadCustomerId: "lead_1" }) })
    );
    expect(contactCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ branchId: "branch_1" }) })
    );
  });

  it("updates a contact only when its branch belongs to the contact customer", async () => {
    const update = vi.fn().mockResolvedValue({ id: "contact_1" });

    await updateContact(
      actor,
      "contact_1",
      {
        leadCustomerId: "lead_1",
        branchId: "branch_1",
        name: "Anita Rao",
        designation: "Procurement Lead",
        email: "anita.rao@example.com",
        phone: "+91 99000 00000",
        isPrimary: true,
        notes: "Updated after customer call"
      },
      {
        leadCustomer: { findUnique: vi.fn().mockResolvedValue({ id: "lead_1" }) },
        branch: { findFirst: vi.fn().mockResolvedValue({ id: "branch_1" }) },
        contact: { findUnique: vi.fn().mockResolvedValue({ id: "contact_1" }), update }
      }
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: "contact_1" },
      data: {
        branchId: "branch_1",
        name: "Anita Rao",
        designation: "Procurement Lead",
        email: "anita.rao@example.com",
        phone: "+91 99000 00000",
        isPrimary: true,
        notes: "Updated after customer call"
      }
    });
  });

  it("creates an open follow-up activity owned by the selected salesperson", async () => {
    const create = vi.fn().mockResolvedValue({ id: "activity_1" });
    const dueAt = new Date("2026-06-20T10:00:00.000Z");

    await createActivity(
      actor,
      {
        leadCustomerId: "lead_1",
        ownerId: "user_admin",
        type: "FOLLOW_UP",
        status: "OPEN",
        subject: "Call procurement team",
        dueAt
      },
      {
        $queryRaw: vi.fn().mockResolvedValue([{ allowed: true }]),
        leadCustomer: { findUnique: vi.fn().mockResolvedValue({ id: "lead_1" }) },
        activity: { create }
      }
    );

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: "user_admin",
        createdById: "user_sales",
        status: "OPEN",
        dueAt
      })
    });
  });

  it("marks an activity complete with completion metadata", async () => {
    const update = vi.fn().mockResolvedValue({ id: "activity_1", status: "COMPLETED" });

    await completeActivity(actor, "activity_1", {
      activity: {
        findUnique: vi.fn().mockResolvedValue({ id: "activity_1" }),
        update
      }
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: "activity_1" },
      data: {
        status: "COMPLETED",
        completedAt: expect.any(Date),
        completedById: "user_sales"
      }
    });
  });

  it("reassigns ownership and writes audit history in one transaction", async () => {
    const update = vi.fn().mockResolvedValue({ id: "lead_1", ownerId: "user_admin" });
    const createHistory = vi.fn().mockResolvedValue({ id: "history_1" });

    await reassignLeadOwner(
      actor,
      {
        leadCustomerId: "lead_1",
        toOwnerId: "user_admin",
        reason: "Account handoff after territory review"
      },
      {
        $queryRaw: vi.fn().mockResolvedValue([{ allowed: true }]),
        leadCustomer: {
          findUnique: vi.fn().mockResolvedValue({ id: "lead_1", ownerId: "user_sales" }),
          update
        },
        leadOwnershipHistory: { create: createHistory },
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            leadCustomer: { update },
            leadOwnershipHistory: { create: createHistory }
          })
      }
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: "lead_1" },
      data: { ownerId: "user_admin", updatedById: "user_sales" }
    });
    expect(createHistory).toHaveBeenCalledWith({
      data: {
        organizationId: "org_test",
        leadCustomerId: "lead_1",
        fromOwnerId: "user_sales",
        toOwnerId: "user_admin",
        changedById: "user_sales",
        reason: "Account handoff after territory review"
      }
    });
  });
});
