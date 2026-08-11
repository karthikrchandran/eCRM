import { describe, expect, it } from "vitest";

import { LocalCellProvider } from "./providers/local-driver";
import { createInMemoryPlatformRepository, CustomerCellProvisioner } from "./provisioning";

const request = {
  cellId: "cell_ara_global",
  cellKey: "ara-global",
  legalName: "ARA Global LLC",
  displayName: "ARA Global",
  region: "us-east-1",
  desiredSubdomain: "ara-global",
  initialAdminEmail: "admin@ara.example",
  idempotencyKey: "onboard-ara-global-1",
  correlationId: "corr-ara-1"
};

describe("CustomerCellProvisioner", () => {
  it("uses the durable request cell identity and invokes the provider lifecycle once after a successful retry", async () => {
    const repository = createInMemoryPlatformRepository();
    const provider = new CountingLocalCellProvider();
    const provisioner = new CustomerCellProvisioner(repository, provider);

    const first = await provisioner.provision(request);
    const second = await provisioner.provision(request);

    expect(second.cell.id).toBe(first.cell.id);
    expect(first.cell).toMatchObject({ id: request.cellId, cellKey: request.cellKey });
    expect(second.cell.lifecycleStatus).toBe("ACTIVE");
    expect(repository.cells()).toHaveLength(1);
    expect(provider.databaseCalls).toBe(1);
  });

  it("rejects a request whose cell ID is already bound to a different durable cell key", async () => {
    const repository = createInMemoryPlatformRepository();
    const provisioner = new CustomerCellProvisioner(repository, new LocalCellProvider());

    await provisioner.provision(request);

    await expect(repository.findCellByIdentity(request.cellId, "other-customer")).resolves.toBeUndefined();
    await expect(provisioner.provision({ ...request, cellKey: "other-customer" })).rejects.toThrow(
      /identity mismatch/i
    );
    expect(repository.cells()).toHaveLength(1);
  });

  it("does not activate a cell when the provider result lacks a valid application URL", async () => {
    const repository = createInMemoryPlatformRepository();
    const provisioner = new CustomerCellProvisioner(repository, new InvalidApplicationUrlProvider());

    const result = await provisioner.provision(request);

    expect(result.cell.lifecycleStatus).toBe("PROVISIONING_FAILED");
    expect(result.cell.applicationUrl).toBeUndefined();
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

class CountingLocalCellProvider extends LocalCellProvider {
  public databaseCalls = 0;

  public override async createDatabase(context: Parameters<LocalCellProvider["createDatabase"]>[0]) {
    this.databaseCalls += 1;
    return super.createDatabase(context);
  }
}

class InvalidApplicationUrlProvider extends LocalCellProvider {
  public override async deployApplication(context: Parameters<LocalCellProvider["deployApplication"]>[0]) {
    const application = await super.deployApplication(context);
    return { ...application, applicationUrl: "not-a-valid-url" };
  }
}
