import { describe, expect, it } from "vitest";

import { LocalCellProvider } from "./providers/local-driver";
import { createInMemoryPlatformRepository, CustomerCellProvisioner } from "./provisioning";

const request = {
  customerKey: "ara-global",
  legalName: "ARA Global LLC",
  displayName: "ARA Global",
  region: "us-east-1",
  desiredSubdomain: "ara-global",
  initialAdminEmail: "admin@ara.example",
  idempotencyKey: "onboard-ara-global-1",
  correlationId: "corr-ara-1"
};

describe("CustomerCellProvisioner", () => {
  it("returns one active CustomerCell for repeated idempotency keys", async () => {
    const repository = createInMemoryPlatformRepository();
    const provisioner = new CustomerCellProvisioner(repository, new LocalCellProvider());

    const first = await provisioner.provision(request);
    const second = await provisioner.provision(request);

    expect(second.cell.id).toBe(first.cell.id);
    expect(second.cell.customerKey).toBe("ara-global");
    expect(second.cell.lifecycleStatus).toBe("ACTIVE");
    expect(repository.cells()).toHaveLength(1);
  });

  it("marks the cell PROVISIONING_FAILED and records durable evidence when health fails", async () => {
    const repository = createInMemoryPlatformRepository();
    const provisioner = new CustomerCellProvisioner(repository, new LocalCellProvider({ health: "unhealthy" }));

    const result = await provisioner.provision(request);

    expect(result.cell.lifecycleStatus).toBe("PROVISIONING_FAILED");
    expect(result.auditEvents.some((event) => event.action === "health-check" && event.result === "FAILED")).toBe(true);
    expect(result.attempt.actions.some((action) => action.step === "health-check" && action.result === "FAILED")).toBe(true);
  });
});
