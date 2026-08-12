import { getServerEnv } from "@/server/env";
import { isConfiguredCellRuntimeActive } from "@/server/runtime/cell-config";
import { CellIntegrationDeliveryService } from "./outbox";
import { configuredDestinationProvider } from "./provider";
import { getIntegrationDeliveryRepository } from "./runtime";

export async function runIntegrationDeliveryOnce(environment: Record<string, string | undefined> = process.env) {
  const runtime = getServerEnv().runtime;
  if (runtime.mode !== "cell") throw new Error("Integration delivery worker requires cell mode");
  if (!await isConfiguredCellRuntimeActive(environment)) throw new Error("Customer cell is not active");
  const repository = getIntegrationDeliveryRepository();
  const worker = new CellIntegrationDeliveryService(repository, configuredDestinationProvider(environment), {
    maxAttempts: positive(environment.INTEGRATION_DELIVERY_MAX_ATTEMPTS, 5),
    baseDelayMs: positive(environment.INTEGRATION_DELIVERY_BASE_DELAY_MS, 1_000),
    maxDelayMs: positive(environment.INTEGRATION_DELIVERY_MAX_DELAY_MS, 300_000),
    leaseMs: positive(environment.INTEGRATION_DELIVERY_LEASE_MS, 30_000)
  });
  const claimed = await worker.runOnce(runtime.cellId, environment.INTEGRATION_WORKER_ID ?? `worker-${process.pid}`);
  return { claimed, status: await repository.status(runtime.cellId) };
}

function positive(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

if (process.argv[1]?.endsWith("integration-delivery/worker.ts")) {
  runIntegrationDeliveryOnce().then((result) => console.log(JSON.stringify(result))).catch((error) => {
    console.error(error instanceof Error ? error.message : "Integration delivery worker failed");
    process.exitCode = 1;
  });
}
