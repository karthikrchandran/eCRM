import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CompanyFinanceOverview } from "./company-finance-overview";

describe("CompanyFinanceOverview", () => {
  it("shows company financial performance and collections sections", () => {
    render(
      <CompanyFinanceOverview
        currency="INR"
        finance={{
          costLeakagePaisa: 50000,
          grossMargin: { approvedCostPaisa: 200000, grossMarginPaisa: 800000, revenuePaisa: 1000000 },
          incentives: { approvedPaisa: 10000, paidPaisa: 5000, payablePaisa: 15000 },
          invoiceStatus: [{ status: "OPEN", count: 2, totalPaisa: 400000 }],
          receivablesAging: [{ bucket: "0-30 days", invoiceCount: 2, outstandingPaisa: 400000 }]
        }}
        topBillings={[]}
      />
    );

    expect(screen.getByRole("heading", { name: "Company financial performance" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Revenue and margin" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Collections" })).toBeVisible();
    expect(within(screen.getByRole("region", { name: "Finance summary" })).getByText("Gross margin")).toBeVisible();
  });
});
