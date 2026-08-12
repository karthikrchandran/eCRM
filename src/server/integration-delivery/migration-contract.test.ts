import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("cell integration delivery migration", () => {
  it("persists hashed credentials, fenced outbox delivery, attempts, checkpoints, and repair candidates", () => {
    const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
    const migration = readFileSync(join(process.cwd(), "prisma/migrations/20260812160000_add_cell_integration_delivery/migration.sql"), "utf8");
    for (const model of ["IntegrationCredential", "CellIntegrationOutbox", "CellIntegrationDeliveryAttempt", "CellIntegrationProjectionCheckpoint", "CellIntegrationRepairCandidate"]) {
      expect(schema).toContain(`model ${model}`);
      expect(migration).toContain(`CREATE TABLE \"${model}\"`);
    }
    expect(schema).toContain("secretHash");
    expect(schema).not.toContain("secretPlaintext");
    expect(schema).toContain("fenceToken");
    expect(schema).toContain("destinationInstallation");
    expect(migration).toContain("UNIQUE (\"cellId\", \"destinationInstallation\", \"idempotencyKey\")");
  });
});
