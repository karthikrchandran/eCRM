import type { RuntimeConfig } from "@/server/runtime/cell-config";

type OutboxTransaction = {
  cellIntegrationOutbox: {
    upsert(args: {
      where: { cellId_destinationInstallation_idempotencyKey: { cellId: string; destinationInstallation: string; idempotencyKey: string } };
      create: Record<string, unknown>;
      update: Record<string, never>;
    }): Promise<unknown>;
  };
  [key: string]: unknown;
};

export async function mutateWithCellOutbox<T>(input: {
  database: { $transaction<R>(operation: (transaction: OutboxTransaction) => Promise<R>): Promise<R> };
  runtime: RuntimeConfig;
  destinationInstallation: string;
  eventType: string;
  correlationId: string;
  idempotencyKey: string | ((record: T) => string);
  mutate(transaction: OutboxTransaction): Promise<T>;
  payload(record: T): Record<string, unknown>;
  payloadVersion(record: T): number;
}): Promise<T> {
  if (input.runtime.mode !== "cell") throw new Error("Cell runtime required");
  if (!input.destinationInstallation.trim()) throw new Error("Destination installation is not configured");
  const cellId = input.runtime.cellId;
  return input.database.$transaction(async (transaction) => {
    const record = await input.mutate(transaction);
    const idempotencyKey = typeof input.idempotencyKey === "function" ? input.idempotencyKey(record) : input.idempotencyKey;
    const identity = {
      cellId,
      destinationInstallation: input.destinationInstallation,
      idempotencyKey
    };
    await transaction.cellIntegrationOutbox.upsert({
      where: { cellId_destinationInstallation_idempotencyKey: identity },
      create: {
        ...identity,
        eventType: input.eventType,
        payloadVersion: input.payloadVersion(record),
        payload: input.payload(record),
        correlationId: input.correlationId
      },
      update: {}
    });
    return record;
  });
}
