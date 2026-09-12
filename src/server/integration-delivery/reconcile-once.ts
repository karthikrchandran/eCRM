import { randomUUID } from "node:crypto";
import { getServerEnv } from "@/server/env";
import { isConfiguredCellRuntimeActive } from "@/server/runtime/cell-config";
import { configuredDestinationProvider } from "./provider";
import { reconcileCellProjectionStreams } from "./reconciliation";
import { getIntegrationDeliveryRepository } from "./runtime";

export async function runIntegrationReconciliationOnce(environment: Record<string, string | undefined> = process.env) {
  const runtime = getServerEnv().runtime;
  if (runtime.mode !== "cell") throw new Error("Integration reconciliation requires cell mode");
  if (!await isConfiguredCellRuntimeActive(environment)) throw new Error("Customer cell is not active");
  const destination = environment.INTEGRATION_DESTINATION_INSTALLATION;
  if (!destination) throw new Error("Destination installation is not configured");
  return reconcileCellProjectionStreams(runtime.cellId, destination, getIntegrationDeliveryRepository(), configuredDestinationProvider(environment), {
    actorId: environment.INTEGRATION_OPERATOR_ID ?? "integration-reconciliation-worker",
    correlationId: environment.INTEGRATION_CORRELATION_ID ?? `corr_${randomUUID()}`,
    reason: environment.INTEGRATION_RECONCILIATION_REASON ?? "Scheduled projection reconciliation",
    now: new Date()
  });
}

if (process.argv[1]?.endsWith("integration-delivery/reconcile-once.ts")) {
  runIntegrationReconciliationOnce().then((result) => console.log(JSON.stringify(result))).catch((error) => {
    console.error(error instanceof Error ? error.message : "Integration reconciliation failed");
    process.exitCode = 1;
  });
}
