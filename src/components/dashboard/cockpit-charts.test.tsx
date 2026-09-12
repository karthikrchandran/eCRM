import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  BookedCollectedTrend,
  DeliveryRiskPanel,
  PipelineStageBars,
  ReceivablesAgingBars
} from "./cockpit-charts";

describe("cockpit visual components", () => {
  it("shows a visible empty-history state with an accessible trend summary", () => {
    render(<BookedCollectedTrend currency="INR" trend={{ hasHistory: false, months: [] }} />);

    expect(screen.getByRole("figure", { name: "Booked vs collected trend" })).toBeVisible();
    expect(screen.getByText("Not enough history yet")).toBeVisible();
  });

  it("exposes a detailed trend alternative and a non-color legend", () => {
    render(
      <BookedCollectedTrend
        currency="INR"
        trend={{
          hasHistory: true,
          months: [
            { bookedPaisa: 210000, collectedPaisa: 150000, label: "Jul" },
            { bookedPaisa: 320000, collectedPaisa: 240000, label: "Aug" }
          ]
        }}
      />
    );

    expect(screen.getByRole("list", { name: "Booked and collected detail" })).toHaveTextContent("Jul: booked INR 2,100.00; collected INR 1,500.00");
    expect(screen.getByRole("list", { name: "Chart legend" })).toHaveTextContent("Booked");
    expect(screen.getByRole("list", { name: "Chart legend" })).toHaveTextContent("Collected");
  });

  it("labels supplied pipeline stages and amounts in the accessible chart", () => {
    render(
      <PipelineStageBars
        currency="INR"
        stages={[{ count: 2, stageId: "qualified", stageName: "Qualified", valuePaisa: 2090000 }]}
      />
    );

    expect(screen.getByRole("img", { name: "Pipeline by stage" })).toHaveTextContent("Qualified");
    expect(screen.getByText("INR 20,900.00")).toBeVisible();
  });

  it("represents every receivables bucket and delivery-risk row", () => {
    render(
      <>
        <ReceivablesAgingBars
          buckets={[
            { bucket: "Current", invoiceCount: 1, outstandingPaisa: 120000 },
            { bucket: "Over 90 days", invoiceCount: 2, outstandingPaisa: 450000 }
          ]}
          currency="INR"
        />
        <DeliveryRiskPanel risk={{ blockedCount: 1, dueSoonCount: 2, overdueCount: 3, totalCount: 6 }} />
      </>
    );

    expect(screen.getByRole("img", { name: "Receivables aging" })).toHaveTextContent("Over 90 days");
    expect(screen.getByText("Blocked")).toBeVisible();
    expect(screen.getByText("Due soon")).toBeVisible();
    expect(screen.getByText("Overdue")).toBeVisible();
  });

  it("keeps pipeline, aging, and risk detail available outside the chart image", () => {
    render(
      <>
        <PipelineStageBars currency="INR" stages={[{ count: 2, stageId: "qualified", stageName: "Qualified", valuePaisa: 2090000 }]} />
        <ReceivablesAgingBars buckets={[{ bucket: "Over 90 days", invoiceCount: 2, outstandingPaisa: 450000 }]} currency="INR" />
        <DeliveryRiskPanel risk={{ blockedCount: 1, dueSoonCount: 2, overdueCount: 3, totalCount: 6 }} />
      </>
    );

    expect(screen.getByRole("list", { name: "Pipeline stage detail" })).toHaveTextContent("Qualified: 2 opportunities, INR 20,900.00");
    expect(screen.getByRole("list", { name: "Receivables aging detail" })).toHaveTextContent("Over 90 days: 2 invoices, INR 4,500.00");
    expect(screen.getByRole("list", { name: "Delivery risk detail" })).toHaveTextContent("Overdue");
  });
});
