import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpportunityForm } from "./opportunity-form";

describe("OpportunityForm", () => {
  it("only offers branches for the selected lead or customer", () => {
    render(
      <OpportunityForm
        action={async () => ({ ok: false })}
        branches={[
          { id: "branch_acme", name: "Acme Bengaluru", leadCustomerId: "lead_acme" },
          { id: "branch_northstar", name: "Northstar Mumbai", leadCustomerId: "lead_northstar" }
        ]}
        leads={[
          { id: "lead_acme", name: "Acme", state: "CUSTOMER" },
          { id: "lead_northstar", name: "Northstar", state: "CUSTOMER" }
        ]}
        owners={[{ id: "user_sales", name: "Sales User", email: "sales@example.com" }]}
        stages={[{ id: "stage_qualified", name: "Qualified" }]}
        submitLabel="Create opportunity"
      />
    );

    fireEvent.change(screen.getByLabelText("Lead/customer"), { target: { value: "lead_acme" } });

    expect(screen.getByRole("option", { name: "Acme Bengaluru" })).toBeVisible();
    expect(screen.queryByRole("option", { name: "Northstar Mumbai" })).not.toBeInTheDocument();
  });
});
