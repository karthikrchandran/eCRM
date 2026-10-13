import { describe, expect, it, vi } from "vitest";
import AdminProductsPage from "./page";

const { notFoundMock } = vi.hoisted(() => ({ notFoundMock: vi.fn(() => { throw new Error("NOT_FOUND"); }) }));

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

vi.mock("@/components/products/product-service-list", () => ({
  ProductServiceList: () => <div>products</div>
}));

vi.mock("@/server/auth/current-user", () => ({
  requireUser: vi.fn()
}));

vi.mock("@/server/products/actions", () => ({
  setProductServiceActiveAction: vi.fn()
}));

vi.mock("@/server/products/queries", () => ({
  listProductServicesForAdmin: vi.fn().mockResolvedValue([])
}));

describe("AdminProductsPage", () => {
  it("fails closed for non-admin users before loading admin product data", async () => {
    const { requireUser } = await import("@/server/auth/current-user");
    const { listProductServicesForAdmin } = await import("@/server/products/queries");

    vi.mocked(requireUser).mockResolvedValue({
      id: "u",
      name: "Sales",
      email: "sales@example.com",
      role: "SALES",
      active: true,
      organizationId: "org",
      membershipId: "m",
      sessionVersion: 1
    });

    await expect(AdminProductsPage()).rejects.toThrow("NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
    expect(listProductServicesForAdmin).not.toHaveBeenCalled();
  });
});
