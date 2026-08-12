import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("cell integration delivery migration", () => {
  it("persists hashed credentials, fenced outbox delivery, attempts, checkpoints, and repair candidates", () => {
    const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
    const migration = [
      "20260812160000_add_cell_integration_delivery",
      "20260812190000_harden_integration_delivery"
    ].map((name) => readFileSync(join(process.cwd(), `prisma/migrations/${name}/migration.sql`), "utf8")).join("\n");
    for (const model of ["IntegrationCredential", "CellIntegrationOutbox", "CellIntegrationDeliveryAttempt", "CellIntegrationProjectionCheckpoint", "CellIntegrationRepairCandidate", "CellIntegrationCircuitBreaker"]) {
      expect(schema).toContain(`model ${model}`);
      expect(migration).toContain(`CREATE TABLE \"${model}\"`);
    }
    expect(schema).toContain("secretHash");
    expect(schema).not.toContain("secretPlaintext");
    expect(schema).toContain("fenceToken");
    expect(schema).toContain("destinationInstallation");
    expect(migration).toContain("UNIQUE (\"cellId\", \"destinationInstallation\", \"idempotencyKey\")");
    expect(migration).toContain("CellIntegrationCircuitState");
    expect(migration).toContain("CellIntegrationRepairCandidate_open_stream_key");
  });
});
