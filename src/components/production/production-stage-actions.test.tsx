import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductionStageActions } from "./production-stage-actions";

describe("ProductionStageActions", () => {
  it("shows an explicit status selector with every production status", () => {
    render(
      <ProductionStageActions
        action={vi.fn()}
        owners={[{ id: "user_sales", name: "Priya Menon", email: "sales@example.com" }]}
        status="DONE"
      />
    );

    const status = screen.getByLabelText("Change status");
    expect(status).toHaveDisplayValue("Done");
    expect(screen.getByRole("option", { name: "Not started" })).toBeVisible();
    expect(screen.getByRole("option", { name: "In progress" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Blocked" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Done" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Skipped" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Update status" })).toHaveClass("crm-button-primary");
  });
});
