import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IntegrationDeliveryPanel } from "./integration-delivery-panel";

describe("integration delivery panel", () => {
  it("shows credential and delivery health metadata without payloads or stored secrets", () => {
    render(<IntegrationDeliveryPanel
      credentials={[{ id: "cred_1", name: "SignalLoop", status: "ACTIVE", capabilities: ["WORKFLOW_EVENTS_WRITE"], expiresAt: "2026-12-01T00:00:00Z", lastUsedAt: null }]}
      status={{ pending: 2, failed: 1, deadLetter: 1, delivered: 8, checkpoint: "checkpoint_8", sourceCount: 10, degraded: true }}
      deadLetters={[{ id: "outbox_1", attempts: 5, errorCode: "REMOTE_503" }]}
      repairCandidates={[{ id: "repair_1", status: "OPEN", sourceCount: 10, destinationCount: 8 }]}
    />);
    expect(screen.getByRole("heading", { name: "Integration delivery" })).toBeVisible();
    expect(screen.getByText(/Degraded/)).toBeVisible();
    expect(screen.getByText("SignalLoop")).toBeInTheDocument();
    expect(screen.getByText(/REMOTE_503/)).toBeInTheDocument();
    expect(screen.queryByText(/payload/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/secret business/i)).not.toBeInTheDocument();
  });
});
