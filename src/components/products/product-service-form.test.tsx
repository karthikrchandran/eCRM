import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductServiceForm } from "./product-service-form";

describe("ProductServiceForm", () => {
  it("renders create fields with active checked and the default GST value", () => {
    render(<ProductServiceForm action={async () => ({ ok: false })} submitLabel="Create product/service" />);

    expect(screen.getByLabelText("Name")).toHaveAttribute("name", "name");
    expect(screen.getByLabelText("Code")).toHaveAttribute("name", "code");
    expect(screen.getByLabelText("Category")).toHaveAttribute("name", "category");
    expect(screen.getByLabelText("Description")).toHaveAttribute("name", "description");
    expect(screen.getByLabelText("GST basis points")).toHaveValue(1800);
    expect(screen.getByLabelText("Production template key")).toHaveAttribute("name", "defaultProductionTemplateKey");
    expect(screen.getByLabelText("Active")).toBeChecked();
    expect(screen.getByLabelText("Sort order")).toHaveValue(0);
    expect(screen.getByRole("button", { name: "Create product/service" })).toBeVisible();
  });

  it("renders edit initial values and field errors", () => {
    render(
      <ProductServiceForm
        action={async () => ({
          ok: false,
          fieldErrors: {
            name: ["Enter a product or service name."],
            defaultGstRateBps: ["Enter GST basis points from 0 to 2800."]
          }
        })}
        initialState={{
          ok: false,
          fieldErrors: {
            name: ["Enter a product or service name."],
            defaultGstRateBps: ["Enter GST basis points from 0 to 2800."]
          }
        }}
        initialValues={{
          id: "prod_1",
          name: "VR module",
          code: "VR-001",
          category: "VR/AR",
          description: "Immersive module",
          defaultGstRateBps: 1800,
          defaultProductionTemplateKey: "vr_ar",
          active: false,
          sortOrder: 30
        }}
        submitLabel="Save product/service"
      />
    );

    expect(screen.getByDisplayValue("VR module")).toBeVisible();
    expect(screen.getByDisplayValue("VR-001")).toBeVisible();
    expect(screen.getByDisplayValue("VR/AR")).toBeVisible();
    expect(screen.getByDisplayValue("Immersive module")).toBeVisible();
    expect(screen.getByDisplayValue("vr_ar")).toBeVisible();
    expect(screen.getByLabelText("Active")).not.toBeChecked();
    expect(screen.getByText("Enter a product or service name.")).toBeVisible();
    expect(screen.getByText("Enter GST basis points from 0 to 2800.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save product/service" })).toBeVisible();
  });
});
