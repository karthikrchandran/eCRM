import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductServiceList } from "./product-service-list";

const products = [
  {
    id: "prod_1",
    name: "eLearning Storyboard",
    code: "ELRN-STB",
    category: "eLearning",
    description: "Storyboard package",
    defaultGstRateBps: 1800,
    defaultProductionTemplateKey: "elearning",
    active: true,
    sortOrder: 10,
    createdAt: new Date("2026-06-15T10:00:00.000Z"),
    updatedAt: new Date("2026-06-15T11:00:00.000Z")
  },
  {
    id: "prod_2",
    name: "Legacy animation bundle",
    code: null,
    category: "Animation",
    description: null,
    defaultGstRateBps: 500,
    defaultProductionTemplateKey: null,
    active: false,
    sortOrder: 20,
    createdAt: new Date("2026-06-15T10:00:00.000Z"),
    updatedAt: new Date("2026-06-15T11:00:00.000Z")
  }
];

describe("ProductServiceList", () => {
  it("renders dense Admin catalog rows with edit and status actions", () => {
    render(<ProductServiceList products={products} toggleActiveAction={async () => {}} />);

    expect(screen.getByRole("heading", { name: "Products and services" })).toBeVisible();
    expect(screen.getByRole("link", { name: "New product/service" })).toHaveAttribute("href", "/admin/products/new");
    expect(screen.getByRole("link", { name: "eLearning Storyboard" })).toHaveAttribute(
      "href",
      "/admin/products/prod_1/edit"
    );
    expect(screen.getByText("ELRN-STB")).toBeVisible();
    expect(screen.getByText("eLearning")).toBeVisible();
    expect(screen.getByText("18%")).toBeVisible();
    expect(screen.getByText("elearning")).toBeVisible();
    expect(screen.getByText("Active")).toBeVisible();
    expect(screen.getByRole("button", { name: "Deactivate eLearning Storyboard" })).toBeVisible();

    expect(screen.getByRole("link", { name: "Legacy animation bundle" })).toHaveAttribute(
      "href",
      "/admin/products/prod_2/edit"
    );
    expect(screen.getByText("No code")).toBeVisible();
    expect(screen.getByText("5%")).toBeVisible();
    expect(screen.getByText("No template")).toBeVisible();
    expect(screen.getByText("Inactive")).toBeVisible();
    expect(screen.getByRole("button", { name: "Reactivate Legacy animation bundle" })).toBeVisible();
  });
});
