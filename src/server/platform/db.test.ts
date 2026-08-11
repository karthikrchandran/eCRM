import { describe, expect, it } from "vitest";

import type { PrismaClient } from "../../generated/platform-client";
import { PrismaPlatformRepository } from "./db";
import type { ControlPlaneAuditEventRecord, ProvisioningAction, ProvisioningRequest } from "./types";

const request: ProvisioningRequest = {
  cellId: "cell_ara",
  cellKey: "ara-global",
  legalName: "Ara Global LLC",
  displayName: "Ara Global",
  region: "us-east-1",
  desiredSubdomain: "ara",
  initialAdminEmail: "admin@ara.example",
  idempotencyKey: "onboard-ara",
  correlationId: "corr-ara",
  actor: "platform-admin",
  reason: "customer onboarding"
};

describe("PrismaPlatformRepository", () => {
  it("returns the concurrent durable reservation without querying an aborted P2002 transaction", async () => {
    let transactionAborted = false;
    const durableCell = cellRecord();
    const transactionClient = {
      customerCell: {
        create: async () => {
          transactionAborted = true;
          throw { code: "P2002" };
        },
        createMany: async () => ({ count: 0 }),
        findFirst: async () => {
          if (transactionAborted) throw new Error("current transaction is aborted");
          return durableCell;
        }
      },
      provisioningAttempt: {
        findFirst: async () => attemptRow("IN_PROGRESS", [])
      }
    };
    const client = {
      $transaction: async <T>(operation: (client: unknown) => Promise<T>) => operation(transactionClient)
    } as unknown as PrismaClient;

    const result = await new PrismaPlatformRepository(client).transaction(async (repository) => {
      const reservation = await repository.reserveCustomerCell(request);
      const attempt = reservation.created ? undefined : await repository.findLatestAttemptForCell(reservation.cell.id);
      return { ...reservation, attempt };
    });

    expect(result).toEqual({
      cell: expect.objectContaining({ id: request.cellId, cellKey: request.cellKey }),
      created: false,
      attempt: expect.objectContaining({ id: "attempt_1", result: "IN_PROGRESS" })
    });
    expect(transactionAborted).toBe(false);
  });

  it("atomically records a provisioning result and audit so a failed audit write leaves neither behind", async () => {
    const database = transactionalDatabase({ failAuditOnce: true });
    const repository = new PrismaPlatformRepository(database.client);
    const action = provisioningAction("database");
    const auditEvent = audit("database");

    await expect(repository.recordProvisioningResult({ attemptId: "attempt_1", action, auditEvent })).rejects.toThrow(
      "audit unavailable"
    );
    expect(database.state.actions).toEqual([]);
    expect(database.state.auditEvents).toEqual([]);

    const attempt = await repository.recordProvisioningResult({ attemptId: "attempt_1", action, auditEvent });

    expect(attempt.actions).toEqual([expect.objectContaining({ step: "database", result: "SUCCEEDED" })]);
    expect(database.state.auditEvents).toEqual([expect.objectContaining({ id: auditEvent.id })]);
  });

  it("rolls back activation completion and safely retries after a cell update crash", async () => {
    const database = transactionalDatabase({ failCellUpdateOnce: true });
    const repository = new PrismaPlatformRepository(database.client);
    const action = provisioningAction("health-check");
    const auditEvent = audit("health-check");

    await expect(
      repository.finalizeProvisioningSuccess({ cellId: request.cellId, attemptId: "attempt_1", action, auditEvent })
    ).rejects.toThrow("cell update unavailable");
    expect(database.state).toMatchObject({ actions: [], auditEvents: [], attemptResult: "IN_PROGRESS", lifecycleStatus: "PROVISIONING" });

    const finalized = await repository.finalizeProvisioningSuccess({
      cellId: request.cellId,
      attemptId: "attempt_1",
      action,
      auditEvent
    });

    expect(finalized.attempt.result).toBe("SUCCEEDED");
    expect(finalized.cell.lifecycleStatus).toBe("ACTIVE");
    expect(database.state.actions).toHaveLength(1);
    expect(database.state.auditEvents).toHaveLength(1);
  });
});

function transactionalDatabase(options: { failAuditOnce?: boolean; failCellUpdateOnce?: boolean }) {
  const state = {
    actions: [] as Array<ReturnType<typeof actionRow>>,
    auditEvents: [] as ControlPlaneAuditEventRecord[],
    attemptResult: "IN_PROGRESS",
    lifecycleStatus: "PROVISIONING"
  };
  let failAudit = options.failAuditOnce ?? false;
  let failCellUpdate = options.failCellUpdateOnce ?? false;

  const client = {
    $transaction: async <T>(operation: (client: unknown) => Promise<T>) => {
      const pending = {
        actions: [...state.actions],
        auditEvents: [...state.auditEvents],
        attemptResult: state.attemptResult,
        lifecycleStatus: state.lifecycleStatus
      };
      const transactionClient = {
        provisioningAction: {
          create: async ({ data }: { data: ProvisioningAction & { attemptId: string } }) => {
            pending.actions.push(actionRow(data));
          }
        },
        provisioningAttempt: {
          findUnique: async () => attemptRow(pending.attemptResult, pending.actions),
          update: async ({ data }: { data: { result: string } }) => {
            pending.attemptResult = data.result;
            return attemptRow(pending.attemptResult, pending.actions);
          }
        },
        controlPlaneAuditEvent: {
          create: async ({ data }: { data: ControlPlaneAuditEventRecord }) => {
            if (failAudit) {
              failAudit = false;
              throw new Error("audit unavailable");
            }
            pending.auditEvents.push(data);
          }
        },
        customerCell: {
          update: async ({ data }: { data: { lifecycleStatus: string } }) => {
            if (failCellUpdate) {
              failCellUpdate = false;
              throw new Error("cell update unavailable");
            }
            pending.lifecycleStatus = data.lifecycleStatus;
            return cellRecord(pending.lifecycleStatus);
          }
        }
      };

      const result = await operation(transactionClient);
      state.actions = pending.actions;
      state.auditEvents = pending.auditEvents;
      state.attemptResult = pending.attemptResult;
      state.lifecycleStatus = pending.lifecycleStatus;
      return result;
    }
  } as unknown as PrismaClient;

  return { client, state };
}

function provisioningAction(step: ProvisioningAction["step"]): ProvisioningAction {
  return { step, result: "SUCCEEDED", reference: step === "database" ? "database://ara" : undefined, occurredAt: new Date("2026-08-11T12:00:00Z") };
}

function audit(action: ControlPlaneAuditEventRecord["action"]): ControlPlaneAuditEventRecord {
  return {
    id: `audit_${action}`,
    cellId: request.cellId,
    correlationId: request.correlationId,
    action,
    result: "SUCCEEDED",
    actor: request.actor,
    reason: request.reason,
    occurredAt: new Date("2026-08-11T12:00:00Z")
  };
}

function actionRow(action: ProvisioningAction & { attemptId?: string }) {
  return {
    step: action.step,
    result: action.result,
    reference: action.reference ?? null,
    errorCode: action.errorCode ?? null,
    occurredAt: action.occurredAt
  };
}

function attemptRow(result: string, actions: Array<ReturnType<typeof actionRow>>) {
  return {
    id: "attempt_1",
    cellId: request.cellId,
    idempotencyKey: request.idempotencyKey,
    correlationId: request.correlationId,
    result,
    createdAt: new Date("2026-08-11T11:00:00Z"),
    updatedAt: new Date("2026-08-11T12:00:00Z"),
    actions
  };
}

function cellRecord(lifecycleStatus = "PROVISIONING") {
  return {
    id: request.cellId,
    cellKey: request.cellKey,
    legalName: request.legalName,
    displayName: request.displayName,
    region: request.region,
    desiredSubdomain: request.desiredSubdomain,
    lifecycleStatus,
    databaseReference: null,
    storageReference: null,
    secretReference: null,
    backupReference: null,
    applicationReference: null,
    applicationUrl: null,
    signalLoopWorkspaceReference: null,
    createdAt: new Date("2026-08-11T11:00:00Z"),
    updatedAt: new Date("2026-08-11T12:00:00Z")
  };
}
