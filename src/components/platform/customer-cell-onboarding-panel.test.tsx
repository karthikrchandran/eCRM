import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CustomerCellOnboardingPanel } from "./customer-cell-onboarding-panel";

describe("CustomerCellOnboardingPanel", () => {
  it("submits the bearer token at runtime and refreshes the cell list", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (String(input).endsWith("/api/platform/cells") && init?.method === "POST") {
        expect((init.headers as Record<string, string>).Authorization).toBe("Bearer runtime-secret");
        return Response.json({ cell: { id: "cell_ara", lifecycleStatus: "PROVISIONING" } }, { status: 201 });
      }
      return Response.json({ cells: [{ id: "cell_ara", lifecycleStatus: "PROVISIONING" }] });
    });

    render(<CustomerCellOnboardingPanel />);
    fireEvent.change(screen.getByLabelText(/platform bearer token/i), { target: { value: "runtime-secret" } });
    fireEvent.change(screen.getByLabelText(/cell id/i), { target: { value: "cell_ara" } });
    fireEvent.change(screen.getByLabelText(/cell key/i), { target: { value: "ara-global" } });
    fireEvent.change(screen.getByLabelText(/legal name/i), { target: { value: "ARA Global Inc." } });
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "ARA Global" } });
    fireEvent.change(screen.getByLabelText(/region/i), { target: { value: "us-east-1" } });
    fireEvent.change(screen.getByLabelText(/subdomain/i), { target: { value: "ara" } });
    fireEvent.change(screen.getByLabelText(/initial admin email/i), { target: { value: "admin@ara-global.demo.local" } });
    fireEvent.click(screen.getByRole("button", { name: /provision customer cell/i }));

    await waitFor(() => expect(screen.getByText(/customer cell provisioned/i)).toBeInTheDocument());
    expect(document.body).not.toHaveTextContent("runtime-secret");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRestore();
  });

  it("renders API errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ error: "Unable to provision customer cell." }, { status: 500 }));
    render(<CustomerCellOnboardingPanel />);
    fireEvent.change(screen.getByLabelText(/platform bearer token/i), { target: { value: "runtime-secret" } });
    fireEvent.click(screen.getByRole("button", { name: /provision customer cell/i }));
    await waitFor(() => expect(screen.getByText("Unable to provision customer cell.")).toBeInTheDocument());
  });
});
