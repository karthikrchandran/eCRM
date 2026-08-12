import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

import type {
  ControlProjectionReconciliationOptions,
  ControlProjectionReconciliationResult
} from "./administration";
import { getPlatformDatabase } from "./db";
import { getPlatformAdministrationService } from "./runtime";

type ReconciliationService = {
  reconcileControlProjections(options: ControlProjectionReconciliationOptions): Promise<ControlProjectionReconciliationResult>;
};

export async function runControlProjectionWorker(
  service: ReconciliationService,
  options: ControlProjectionReconciliationOptions
): Promise<ControlProjectionReconciliationResult> {
  return service.reconcileControlProjections(options);
}

async function runCli(): Promise<void> {
  const options: ControlProjectionReconciliationOptions = {
    workerId: process.env.CONTROL_PROJECTION_WORKER_ID?.trim() || `projection-cli-${randomUUID()}`,
    batchSize: environmentInteger("CONTROL_PROJECTION_BATCH_SIZE", 25),
    maxAttempts: environmentInteger("CONTROL_PROJECTION_MAX_ATTEMPTS", 8),
    leaseDurationMs: environmentInteger("CONTROL_PROJECTION_LEASE_MS", 30_000),
    baseBackoffMs: environmentInteger("CONTROL_PROJECTION_BACKOFF_MS", 1_000)
  };
  try {
    const result = await runControlProjectionWorker(getPlatformAdministrationService(), options);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await getPlatformDatabase().$disconnect();
  }
}

function environmentInteger(name: string, fallback: number): number {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Control projection worker failed";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
