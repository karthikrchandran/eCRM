import { describe, expect, it } from "vitest";
import {
  activityInputSchema,
  branchInputSchema,
  contactInputSchema,
  leadCustomerInputSchema,
  leadFilterSchema,
  reassignmentInputSchema
} from "./validators";

describe("crm validators", () => {
  it("normalizes lead/customer input", () => {
    const parsed = leadCustomerInputSchema.parse({
      name: "  Acme Learning Pvt Ltd  ",
      state: "CUSTOMER",
      industry: "  eLearning  ",
      source: " Referral ",
      ownerId: "user_sales",
      notes: "  Repeat customer  "
    });

    expect(parsed).toEqual({
      name: "Acme Learning Pvt Ltd",
      state: "CUSTOMER",
      industry: "eLearning",
      source: "Referral",
      ownerId: "user_sales",
      notes: "Repeat customer"
    });
  });

  it("requires a lead/customer name and owner", () => {
    const result = leadCustomerInputSchema.safeParse({
      name: " ",
      state: "LEAD",
      ownerId: ""
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain("Enter a lead or customer name.");
      expect(result.error.flatten().fieldErrors.ownerId).toContain("Choose an owner.");
    }
  });

  it("validates branch and contact attachment input", () => {
    expect(
      branchInputSchema.parse({
        leadCustomerId: "lead_1",
        name: " Bengaluru Branch ",
        city: " Bengaluru ",
        country: ""
      })
    ).toMatchObject({
      leadCustomerId: "lead_1",
      name: "Bengaluru Branch",
      city: "Bengaluru",
      country: "India"
    });

    expect(
      contactInputSchema.parse({
        leadCustomerId: "lead_1",
        branchId: "branch_1",
        name: " Anita Rao ",
        email: " ANITA@EXAMPLE.COM ",
        phone: " +91 98765 43210 ",
        isPrimary: "on"
      })
    ).toMatchObject({
      name: "Anita Rao",
      email: "anita@example.com",
      phone: "+91 98765 43210",
      isPrimary: true
    });
  });

  it("requires activity due date for open follow-ups", () => {
    const result = activityInputSchema.safeParse({
      leadCustomerId: "lead_1",
      ownerId: "user_sales",
      type: "FOLLOW_UP",
      status: "OPEN",
      subject: "Send revised brochure"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.dueAt).toContain("Choose a follow-up date.");
    }
  });

  it("accepts list filters without hiding company records by role", () => {
    const parsed = leadFilterSchema.parse({
      q: " acme ",
      ownerId: "user_sales",
      state: "LEAD",
      followUp: "overdue"
    });

    expect(parsed).toEqual({
      q: "acme",
      ownerId: "user_sales",
      state: "LEAD",
      followUp: "overdue"
    });
  });

  it("requires reassignment reason when owner changes", () => {
    const result = reassignmentInputSchema.safeParse({
      leadCustomerId: "lead_1",
      toOwnerId: "user_admin",
      reason: " "
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.reason).toContain("Enter a reassignment reason.");
    }
  });
});
