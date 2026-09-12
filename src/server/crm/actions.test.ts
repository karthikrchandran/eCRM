import { describe, expect, it } from "vitest";
import { parseContactFormForTest, parseLeadCustomerFormForTest } from "./actions";

describe("crm actions", () => {
  it("returns field errors from lead form parsing", () => {
    const formData = new FormData();
    formData.set("name", "");
    formData.set("state", "LEAD");
    formData.set("ownerId", "");

    const result = parseLeadCustomerFormForTest(formData);

    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        name: ["Enter a lead or customer name."],
        ownerId: ["Choose an owner."]
      }
    });
  });

  it("parses valid lead form data", () => {
    const formData = new FormData();
    formData.set("name", "Acme Learning Pvt Ltd");
    formData.set("state", "LEAD");
    formData.set("ownerId", "user_sales");
    formData.set("source", "Referral");

    const result = parseLeadCustomerFormForTest(formData);

    expect(result).toEqual({
      ok: true,
      data: {
        name: "Acme Learning Pvt Ltd",
        state: "LEAD",
        ownerId: "user_sales",
        source: "Referral"
      }
    });
  });

  it("parses an edited contact with normalized email", () => {
    const formData = new FormData();
    formData.set("leadCustomerId", "lead_1");
    formData.set("branchId", "branch_1");
    formData.set("name", " Anita Rao ");
    formData.set("email", " ANITA.RAO@example.com ");
    formData.set("isPrimary", "on");

    expect(parseContactFormForTest("lead_1", formData)).toEqual({
      ok: true,
      data: {
        leadCustomerId: "lead_1",
        branchId: "branch_1",
        name: "Anita Rao",
        email: "anita.rao@example.com",
        isPrimary: true
      }
    });
  });
});
