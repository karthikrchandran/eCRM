// @vitest-environment node
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaIntegrationDeliveryRepository } from "./prisma-outbox";
import { mutateWithCellOutbox } from "./source-outbox";
import { upsertSharedRecord } from "@/server/shared-records/mutations";

const baseDatabaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgresql://ecrm:ecrm@localhost:54329/ecrm?schema=public";
const schemaName = `delivery_${randomUUID().replaceAll("-", "")}`;
let admin: PrismaClient;
let client: PrismaClient;
let repository: PrismaIntegrationDeliveryRepository;
let scopedDatabaseUrl: string;

describe("Prisma/PostgreSQL integration delivery repository", () => {
  beforeAll(async () => {
    admin = new PrismaClient({ datasourceUrl: baseDatabaseUrl });
    await connectWithRetry(admin);
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
    const scopedUrl = new URL(baseDatabaseUrl);
    scopedUrl.searchParams.set("schema", schemaName);
    scopedDatabaseUrl = scopedUrl.toString();
    execFileSync(process.execPath, [join(process.cwd(), "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"], {
      cwd: join(process.cwd()), env: { ...process.env, DATABASE_URL: scopedDatabaseUrl }, stdio: "pipe"
    });
    client = new PrismaClient({ datasourceUrl: scopedDatabaseUrl });
    repository = new PrismaIntegrationDeliveryRepository(client);
  }, 120_000);

  afterAll(async () => {
    await client?.$disconnect();
    if (admin) {
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await admin.$disconnect();
    }
  });

  it("rolls back the source and outbox together when event construction fails", async () => {
    await expect(mutateWithCellOutbox({
      database: client as never,
      runtime: { mode: "cell", cellId: "cell_ara", cellKey: "ara" },
      destinationInstallation: "signalloop:ara", eventType: "shared-record.changed", correlationId: "corr_rollback",
      idempotencyKey: (record: { id: string; headVersion: number }) => `shared-record:${record.id}:${record.headVersion}`,
      mutate: (transaction) => (transaction.sharedBusinessRecord as typeof client.sharedBusinessRecord).create({ data: {
        id: "shared_rollback", entityType: "CUSTOMER", displayName: "Rollback", status: "ACTIVE", sourceApp: "ecrm",
        ecrmLegacyId: "rollback", searchText: "rollback active", data: {}
      } }),
      payload: () => { throw new Error("payload failed"); }, payloadVersion: (record) => record.headVersion
    })).rejects.toThrow("payload failed");
    await expect(client.sharedBusinessRecord.count({ where: { id: "shared_rollback" } })).resolves.toBe(0);
    await expect(client.cellIntegrationOutbox.count({ where: { correlationId: "corr_rollback" } })).resolves.toBe(0);
  });

  it("uses database CAS claims, recovers expired leases, and persists across repository restarts", async () => {
    const input = outbox("cell_ara", "claim_once");
    const created = await repository.enqueue(input);
    const at = new Date("2030-08-12T12:00:00Z");
    const [first, second] = await Promise.all([
      repository.claim("cell_ara", "worker_a", at, 1_000),
      repository.claim("cell_ara", "worker_b", at, 1_000)
    ]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
    const restartClient = new PrismaClient({ datasourceUrl: scopedDatabaseUrl });
    const restart = new PrismaIntegrationDeliveryRepository(restartClient);
    try {
      expect((await restart.deadLetters("cell_ara"))).toHaveLength(0);
      const recovered = await restart.claim("cell_ara", "worker_restart", new Date(at.getTime() + 1_001), 1_000);
      expect(recovered).toMatchObject({ id: created.id, leaseOwner: "worker_restart" });
      await restart.ack(recovered!.id, recovered!.fenceToken!, new Date(at.getTime() + 1_002));
    } finally {
      await restartClient.$disconnect();
    }
  });

  it("scopes status, claims, and dead-letter replay to the authenticated cell", async () => {
    const at = new Date("2030-08-12T13:00:00Z");
    const ara = await repository.enqueue(outbox("cell_ara", "cross_cell_ara"));
    await repository.enqueue(outbox("cell_other", "cross_cell_other"));
    const claimed = await repository.claim("cell_ara", "worker_a", at, 30_000);
    expect(claimed?.id).toBe(ara.id);
    await repository.fail(claimed!.id, claimed!.fenceToken!, at, at, "failed", "REMOTE_503", 1);
    await expect(repository.replay("cell_other", ara.id, "admin_other", "Cross-cell attempt", at)).rejects.toThrow("Dead letter not found");
    expect(await repository.deadLetters("cell_ara")).toHaveLength(1);
    expect(await repository.deadLetters("cell_other")).toHaveLength(0);
    await repository.replay("cell_ara", ara.id, "admin_ara", "Destination restored", at);
    expect(await repository.deadLetters("cell_ara")).toHaveLength(0);
  });

  it("preserves immutable delivery attempts across replay and repository restart", async () => {
    const cellId = "cell_replay_history";
    const firstAt = new Date("2030-08-12T13:30:00Z");
    const created = await repository.enqueue(outbox(cellId, "replay_history"));
    const firstClaim = await repository.claim(cellId, "worker_first", firstAt, 30_000);
    expect(firstClaim?.id).toBe(created.id);
    await repository.fail(firstClaim!.id, firstClaim!.fenceToken!, firstAt, firstAt, "failed", "REMOTE_503", 1);

    await repository.replay(cellId, created.id, "admin_replay", "Destination restored", new Date(firstAt.getTime() + 1));

    const restartClient = new PrismaClient({ datasourceUrl: scopedDatabaseUrl });
    const restart = new PrismaIntegrationDeliveryRepository(restartClient);
    try {
      await expect(restartClient.cellIntegrationDeliveryAttempt.findMany({
        where: { outboxId: created.id }, orderBy: { attemptNumber: "asc" }
      })).resolves.toMatchObject([{ attemptNumber: 1, result: "DEAD_LETTER" }]);

      const replayed = await restart.claim(cellId, "worker_restart", new Date(firstAt.getTime() + 2), 30_000);
      expect(replayed?.id).toBe(created.id);
      await restart.ack(replayed!.id, replayed!.fenceToken!, new Date(firstAt.getTime() + 3), "ack_replayed");

      await expect(restartClient.cellIntegrationDeliveryAttempt.findMany({
        where: { outboxId: created.id }, orderBy: { attemptNumber: "asc" }
      })).resolves.toMatchObject([
        { attemptNumber: 1, result: "DEAD_LETTER" },
        { attemptNumber: 2, result: "DELIVERED", acknowledgementId: "ack_replayed" }
      ]);
    } finally {
      await restartClient.$disconnect();
    }
  });

  it("persists one stable outbox event for an ambiguous source retry and a new version for a later change", async () => {
    const previous = { APP_MODE: process.env.APP_MODE, CELL_ID: process.env.CELL_ID, CELL_KEY: process.env.CELL_KEY, INTEGRATION_DESTINATION_INSTALLATION: process.env.INTEGRATION_DESTINATION_INSTALLATION };
    Object.assign(process.env, { APP_MODE: "cell", CELL_ID: "cell_ara", CELL_KEY: "ara", INTEGRATION_DESTINATION_INSTALLATION: "signalloop:ara" });
    const input = { entityType: "CUSTOMER", displayName: "Stable Record", status: "ACTIVE", sourceApp: "ecrm", ecrmLegacyId: "stable_1", data: { tier: "gold" } };
    try {
      const first = await upsertSharedRecord(input, client as never);
      const retry = await upsertSharedRecord(input, client as never);
      expect(first.record.headVersion).toBe(1);
      expect(retry.record.headVersion).toBe(1);
      await expect(client.cellIntegrationOutbox.count({ where: { idempotencyKey: `shared-record:${first.record.id}:1` } })).resolves.toBe(1);

      const changed = await upsertSharedRecord({ ...input, displayName: "Stable Record Updated" }, client as never);
      expect(changed.record.headVersion).toBe(2);
      await expect(client.cellIntegrationOutbox.count({ where: { cellId: "cell_ara", destinationInstallation: "signalloop:ara" } })).resolves.toBe(2);
      await expect(repository.sourceState("cell_ara", "SHARED_RECORD")).resolves.toEqual({
        count: 1, version: 2, checkpoint: "source:SHARED_RECORD:1:2"
      });
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it("leases only one real PostgreSQL half-open probe with compare-and-swap", async () => {
    const at = new Date("2030-08-12T14:00:00Z");
    await client.cellIntegrationCircuitBreaker.create({ data: {
      cellId: "cell_ara", destinationInstallation: "signalloop:circuit", state: "OPEN", failureCount: 3,
      openedAt: new Date(at.getTime() - 60_000), openUntil: at
    } });
    const [first, second] = await Promise.all([
      repository.acquireCircuitPermit("cell_ara", "signalloop:circuit", "worker_a", at, 30_000),
      repository.acquireCircuitPermit("cell_ara", "signalloop:circuit", "worker_b", at, 30_000)
    ]);
    expect([first, second].filter((permit) => permit.allowed)).toHaveLength(1);
    expect(await client.cellIntegrationCircuitBreaker.findUnique({ where: { cellId_destinationInstallation: { cellId: "cell_ara", destinationInstallation: "signalloop:circuit" } } })).toMatchObject({ state: "HALF_OPEN" });
    await expect(client.cellAuditEvent.count({ where: { action: "integration-circuit.half-open" } })).resolves.toBe(1);
  });
});

function outbox(cellId: string, idempotencyKey: string) {
  return {
    cellId, eventType: "shared-record.changed", payloadVersion: 1, payload: { recordId: idempotencyKey },
    correlationId: `corr_${idempotencyKey}`, idempotencyKey, destinationInstallation: "signalloop:shared"
  };
}

async function connectWithRetry(database: PrismaClient): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await database.$connect();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError;
}
