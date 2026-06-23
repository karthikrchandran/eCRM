import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LeadImportForm } from "./lead-import-form";

describe("LeadImportForm", () => {
  it("guides users to download the template and preview before importing", () => {
    render(<LeadImportForm action={vi.fn()} />);

    expect(screen.getByText(/Download the template first/)).toBeVisible();
    expect(screen.getByText(/Use Preview CSV to check row errors before Import CSV writes records/)).toBeVisible();
    expect(screen.getByRole("link", { name: /Download lead CSV template/ })).toHaveAttribute("href", "/leads/import/template");
    expect(screen.getByRole("button", { name: /Preview CSV/ })).toBeVisible();
  });
});
