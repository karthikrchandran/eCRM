import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RepComparisonTable } from "./rep-comparison-table";
import type { RepPerformanceSummary } from "@/server/reports/rep-performance-queries";

const rows: RepPerformanceSummary[] = [
  {
    rep: { id: "rep_priya", name: "Priya Menon", email: "priya@example.com" },
    targetPaisa: 12000000,
    bookedPaisa: 9600000,
    collectedPaisa: 6000000,
    pendingReceivablePaisa: 3600000,
    incentivePayablePaisa: 30000,
    orderCount: 3
  },
  {
    rep: { id: "rep_arun", name: "Arun Kumar", email: "arun@example.com" },
    targetPaisa: 8000000,
    bookedPaisa: 0,
    collectedPaisa: 0,
    pendingReceivablePaisa: 0,
    incentivePayablePaisa: 0,
    orderCount: 0
  }
];

describe("RepComparisonTable", () => {
  it("renders the page heading", () => {
    render(<RepComparisonTable filters={{}} rows={rows} />);
    expect(screen.getByRole("heading", { name: "Team performance" })).toBeVisible();
  });

  it("shows one row per rep with their name", () => {
    render(<RepComparisonTable filters={{}} rows={rows} />);
    expect(screen.getByText("Priya Menon")).toBeVisible();
    expect(screen.getByText("Arun Kumar")).toBeVisible();
  });

  it("shows the order count per rep", () => {
    render(<RepComparisonTable filters={{}} rows={rows} />);
    expect(screen.getByText("3")).toBeVisible();
    expect(screen.getByText("0")).toBeVisible();
  });

  it("shows a percentage of target for reps with a target set", () => {
    render(<RepComparisonTable filters={{}} rows={rows} />);
    expect(screen.getByText("80%")).toBeVisible();
  });

  it("shows a dash for reps with no target set", () => {
    const noTargetRows: RepPerformanceSummary[] = [{ ...rows[0], targetPaisa: 0, bookedPaisa: 5000000 }];
    render(<RepComparisonTable filters={{}} rows={noTargetRows} />);
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
  });

  it("shows the filter form linked to the admin performance route", () => {
    render(<RepComparisonTable filters={{ financialYear: 2026, quarter: 2 }} rows={rows} />);
    expect(screen.getByRole("button", { name: "Apply" })).toBeVisible();
  });

  it("shows an empty state when there are no reps", () => {
    render(<RepComparisonTable filters={{}} rows={[]} />);
    expect(screen.getByText("No reps found.")).toBeVisible();
  });
});
