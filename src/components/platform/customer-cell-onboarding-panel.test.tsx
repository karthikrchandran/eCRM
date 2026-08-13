import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CustomerCellOnboardingPanel } from "./customer-cell-onboarding-panel";

describe("CustomerCellOnboardingPanel", () => {
  it("submits the bearer token at runtime and refreshes the cell list", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (String(input).endsWith("/api/platform/cells") && init?.method === "POST") {
        expect((init.headers as Record<string, string>).Authorization).toBe("Bearer runtime-secret");
        requestBody = JSON.parse(String(init.body));
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
    fireEvent.change(screen.getByLabelText(/idempotency key/i), { target: { value: "stable-idempotency" } });
    fireEvent.change(screen.getByLabelText(/correlation id/i), { target: { value: "stable-correlation" } });
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: "approved onboarding" } });
    fireEvent.click(screen.getByLabelText("reports"));
    fireEvent.click(screen.getByRole("button", { name: /provision customer cell/i }));

    await waitFor(() => expect(screen.getByText(/customer cell provisioned/i)).toBeInTheDocument());
    expect(document.body).not.toHaveTextContent("runtime-secret");
    expect(requestBody).toMatchObject({
      idempotencyKey: "stable-idempotency",
      correlationId: "stable-correlation",
      reason: "approved onboarding",
      allowedModules: expect.arrayContaining(["reports"])
    });
    expect(requestBody?.allowedModules).not.toEqual(["crm", "opportunities", "proposals", "orders", "production", "finance", "reports"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRestore();
  });

  it("reuses idempotency and correlation values when the operator retries", async () => {
    const bodies: Record<string, unknown>[] = [];
    let attempts = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      if (init?.method === "POST") {
        bodies.push(JSON.parse(String(init.body)));
        attempts += 1;
        if (attempts === 1) return Response.json({ error: "temporary failure" }, { status: 503 });
        return Response.json({ cell: { id: "cell_ara", lifecycleStatus: "PROVISIONING" } }, { status: 201 });
      }
      return Response.json({ cells: [] });
    });
    render(<CustomerCellOnboardingPanel />);
    fireEvent.change(screen.getByLabelText(/idempotency key/i), { target: { value: "retry-idempotency" } });
    fireEvent.change(screen.getByLabelText(/correlation id/i), { target: { value: "retry-correlation" } });
    const submit = screen.getByRole("button", { name: /provision customer cell/i });
    fireEvent.click(submit);
    await waitFor(() => expect(screen.getByText("temporary failure")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /provision customer cell/i }));
    await waitFor(() => expect(screen.getByText(/customer cell provisioned/i)).toBeInTheDocument());
    expect(bodies).toHaveLength(2);
    expect(bodies[0].idempotencyKey).toBe(bodies[1].idempotencyKey);
    expect(bodies[0].correlationId).toBe(bodies[1].correlationId);
  });

  it("renders API errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ error: "Unable to provision customer cell." }, { status: 500 }));
    render(<CustomerCellOnboardingPanel />);
    fireEvent.change(screen.getByLabelText(/platform bearer token/i), { target: { value: "runtime-secret" } });
    fireEvent.click(screen.getByRole("button", { name: /provision customer cell/i }));
    await waitFor(() => expect(screen.getByText("Unable to provision customer cell.")).toBeInTheDocument());
  });
});
