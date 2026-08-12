import {
  CellAdministrationService,
  createInMemoryCellAdministrationRepository,
  type LocalUserRecord
} from "@/server/cell-admin/service";
import {
  authorizeSupportAccess,
  issueSupportAccessToken,
  type SupportGrantProjection
} from "@/server/cell-admin/support-access";
import {
  createInMemoryIntegrationCredentialRepository,
  IntegrationCredentialService
} from "@/server/integration-delivery/credentials";
import {
  CellIntegrationDeliveryService,
  createInMemoryIntegrationDeliveryRepository,
  type DestinationProvider,
  type IntegrationDeliveryRepository,
  type OutboxRecord,
  type ProjectionState
} from "@/server/integration-delivery/outbox";
import { reconcileCellProjection } from "@/server/integration-delivery/reconciliation";
import { LocalCellProvider } from "@/server/platform/providers/local-driver";
import {
  createInMemoryPlatformRepository,
  CustomerCellProvisioner,
  type ProvisioningOutcome
} from "@/server/platform/provisioning";
import type { CustomerCellRecord, ProvisioningRequest } from "@/server/platform/types";

type CellKey = "ara-global" | "ai-consulting";

type SyntheticIdentity = {
  databaseName: string;
  schemaName: string;
  storagePrefix: string;
  credentialReference: string;
  baseUrl: string;
  workspaceId: string;
  initialAdmin: string;
};

type SyntheticCell = {
  cell: CustomerCellRecord;
  identity: SyntheticIdentity;
  admin: CellAdministrationService;
  credentials: IntegrationCredentialService;
  secret: string;
  outbox: IntegrationDeliveryRepository;
  restoreGeneration: number;
  provider: LocalCellProvider;
};

type SyntheticSupportGrant = SupportGrantProjection & { token: string };

const fixedNow = new Date("2026-08-12T12:00:00Z");
const supportSecret = "synthetic-support-secret-is-at-least-32-characters";

class SyntheticDestination implements DestinationProvider {
  private readonly remainingTimeouts = new Map<string, number>();
  private readonly receipts = new Map<string, { acknowledgementId: string; checkpoint: string }>();

  public timeout(workspaceId: string, attempts: number): void {
    this.remainingTimeouts.set(workspaceId, attempts);
  }

  public recover(workspaceId: string): void {
    this.remainingTimeouts.delete(workspaceId);
  }

  public async deliver(
    destinationInstallation: string,
    message: { idempotencyKey: string },
    _signal?: AbortSignal
  ): Promise<{ acknowledgementId: string; checkpoint: string }> {
    void _signal;
    const remaining = this.remainingTimeouts.get(destinationInstallation) ?? 0;
    if (remaining > 0) {
      this.remainingTimeouts.set(destinationInstallation, remaining - 1);
      throw Object.assign(new Error("synthetic destination timeout"), { code: "REQUEST_TIMEOUT" });
    }
    const acknowledgement = {
      acknowledgementId: `receipt:${destinationInstallation}:${message.idempotencyKey}`,
      checkpoint: `checkpoint:${destinationInstallation}:${message.idempotencyKey}`
    };
    this.receipts.set(`${destinationInstallation}:${message.idempotencyKey}`, acknowledgement);
    return acknowledgement;
  }

  public async reconcileIdempotency(destinationInstallation: string, idempotencyKey: string) {
    return this.receipts.get(`${destinationInstallation}:${idempotencyKey}`);
  }

  public async checkpoint(_destinationInstallation: string): Promise<ProjectionState> {
    void _destinationInstallation;
    return { count: 0, version: 0, checkpoint: null };
  }
}

export async function createSyntheticCustomerCellAcceptanceHarness() {
  const destination = new SyntheticDestination();
  const cells = new Map<CellKey, SyntheticCell>();
  for (const fixture of [
    fixtureFor("ara-global", "ARA Global", "admin@ara.synthetic.invalid"),
    fixtureFor("ai-consulting", "AI Consulting", "admin@ai.synthetic.invalid")
  ] as const) {
    const provider = new LocalCellProvider();
    const outcome = await new CustomerCellProvisioner(createInMemoryPlatformRepository(), provider).provision(fixture.request);
    const identity: SyntheticIdentity = {
      databaseName: `ecrm_${fixture.key.replaceAll("-", "_")}`,
      schemaName: `cell_${fixture.key.replaceAll("-", "_")}`,
      storagePrefix: required(outcome.cell.storageReference),
      credentialReference: required(outcome.cell.secretReference),
      baseUrl: required(outcome.cell.applicationUrl),
      workspaceId: `workspace-${fixture.key}`,
      initialAdmin: fixture.request.initialAdminEmail
    };
    const initialAdmin: LocalUserRecord = {
      id: `${fixture.key}-owner`,
      name: `${fixture.displayName} Owner`,
      email: fixture.request.initialAdminEmail,
      role: "ADMIN",
      active: true
    };
    const admin = new CellAdministrationService(
      createInMemoryCellAdministrationRepository({
        allowedModules: fixture.request.allowedModules,
        users: [initialAdmin]
      }),
      async (password) => `synthetic:${password}`,
      () => fixedNow
    );
    const credentialRepository = createInMemoryIntegrationCredentialRepository();
    const credentials = new IntegrationCredentialService(credentialRepository, {
      runtime: { mode: "cell", cellId: outcome.cell.id, cellKey: fixture.key },
      now: () => fixedNow,
      hashSecret: async (secret) => `hash:${secret}`,
      compareSecret: async (secret, digest) => digest === `hash:${secret}`,
      createSecret: (credentialId) => `ecrm_${credentialId}.${fixture.key.replaceAll("-", "_")}_secret`
    });
    const issued = await credentials.issue(
      { id: initialAdmin.id, role: "ADMIN" },
      {
        name: "SignalLoop projection delivery",
        capabilities: ["PROJECTION_DELIVER"],
        expiresAt: new Date("2027-08-12T12:00:00Z"),
        correlationId: `credential-${fixture.key}`,
        reason: "Synthetic acceptance installation"
      }
    );
    cells.set(fixture.key, {
      cell: outcome.cell,
      identity,
      admin,
      credentials,
      secret: issued.secret,
      outbox: createInMemoryIntegrationDeliveryRepository(),
      restoreGeneration: 0,
      provider
    });
  }

  return {
    destination,
    cell(key: CellKey) {
      const cell = cells.get(key);
      if (!cell) throw new Error(`Unknown synthetic cell ${key}`);
      return cell;
    },
    async provisionHealthFailure(suffix: string): Promise<ProvisioningOutcome> {
      const fixture = fixtureFor(`health-${suffix}`, "Health Failure", `admin@${suffix}.synthetic.invalid`);
      return new CustomerCellProvisioner(
        createInMemoryPlatformRepository(),
        new LocalCellProvider({ health: "unhealthy" })
      ).provision(fixture.request);
    },
    backup(key: CellKey): string {
      return required(this.cell(key).cell.backupReference);
    },
    async restore(key: CellKey, backupReference: string): Promise<void> {
      const target = this.cell(key);
      if (backupReference !== target.cell.backupReference) {
        throw new Error("Restore reference belongs to another customer cell");
      }
      const restored = await target.provider.validateRestore(providerContext(target.cell), backupReference);
      if (!restored.healthy) throw new Error("Restore validation failed");
      target.restoreGeneration += 1;
    },
    async rotateCredential(key: CellKey) {
      const target = this.cell(key);
      const [current] = await target.credentials.list({ id: `${key}-owner`, role: "ADMIN" });
      if (!current) throw new Error("Synthetic credential missing");
      return target.credentials.rotate(
        { id: `${key}-owner`, role: "ADMIN" },
        current.id,
        {
          expiresAt: new Date("2028-08-12T12:00:00Z"),
          correlationId: `rotate-${key}`,
          reason: "Synthetic acceptance rotation"
        }
      );
    },
    async supportGrant(key: CellKey): Promise<SyntheticSupportGrant> {
      const target = this.cell(key);
      const grant: SupportGrantProjection = {
        id: `grant-${key}`,
        cellId: target.cell.id,
        operatorId: "support-operator",
        caseReference: `CASE-${key}`,
        capabilities: ["configuration:read"],
        startsAt: fixedNow,
        expiresAt: new Date("2026-08-12T12:05:00Z")
      };
      return { ...grant, token: await issueSupportAccessToken(grant, supportSecret) };
    },
    authorizeSupport(key: CellKey, grant: SyntheticSupportGrant, now: string) {
      const target = this.cell(key);
      return authorizeSupportAccess(
        new Request("https://cell.synthetic.invalid/api/support/access", {
          headers: {
            Authorization: `Bearer ${grant.token}`,
            "X-Support-Operator-Id": grant.operatorId,
            "X-Support-Case-Reference": grant.caseReference,
            "X-Correlation-Id": `support-${key}`
          }
        }),
        "configuration:read",
        {
          runtime: { mode: "cell", cellId: target.cell.id, cellKey: key },
          secret: supportSecret,
          now: () => new Date(now),
          findControl: async (cellId) => cellId === target.cell.id
            ? { cellId, lifecycleStatus: target.cell.lifecycleStatus }
            : undefined,
          findGrant: async (grantId) => grantId === grant.id ? grant : undefined,
          audit: async () => undefined
        }
      );
    },
    async enqueue(key: CellKey, payload: Record<string, unknown>): Promise<OutboxRecord> {
      const target = this.cell(key);
      if (!target.outbox.withSourceMutation) throw new Error("Synthetic outbox lacks atomic source mutation");
      return target.outbox.withSourceMutation(async (transaction) => {
        await transaction.writeSource(`installation:${key}`, { ...payload, stream: "SHARED_RECORD" });
        return transaction.enqueue({
          cellId: target.cell.id,
          eventType: "SHARED_RECORD",
          payloadVersion: 1,
          payload,
          correlationId: `delivery-${key}`,
          idempotencyKey: `installation-${key}-v1`,
          destinationInstallation: target.identity.workspaceId
        });
      });
    },
    runDelivery(key: CellKey, at: string) {
      const target = this.cell(key);
      return new CellIntegrationDeliveryService(target.outbox, destination, {
        now: () => new Date(at),
        random: () => 0,
        maxAttempts: 2,
        baseDelayMs: 1_000,
        maxDelayMs: 1_000,
        leaseMs: 1_000,
        failureThreshold: 2,
        failureWindowMs: 60_000,
        circuitOpenMs: 30_000
      }).runOnce(target.cell.id, `worker-${key}`, new Date(at));
    },
    replay(key: CellKey, outboxId: string, reason: string) {
      const target = this.cell(key);
      return target.outbox.replay(target.cell.id, outboxId, "operator:synthetic", reason, new Date("2026-08-12T12:00:02Z"));
    },
    reconcile(key: CellKey, destinationState: ProjectionState) {
      const target = this.cell(key);
      return reconcileCellProjection(
        target.cell.id,
        target.identity.workspaceId,
        target.outbox,
        { checkpoint: async () => destinationState },
        {
          actorId: "operator:synthetic",
          correlationId: `reconcile-${key}`,
          reason: "Synthetic acceptance reconciliation",
          now: fixedNow
        }
      );
    }
  };
}

function fixtureFor<const TKey extends string>(key: TKey, displayName: string, initialAdminEmail: string) {
  return {
    key,
    displayName,
    request: {
      cellId: `cell-${key}`,
      cellKey: key,
      legalName: `${displayName} Synthetic LLC`,
      displayName,
      region: "us-east-1",
      desiredSubdomain: key,
      planCode: "ENTERPRISE",
      allowedModules: ["crm", "finance"],
      initialAdminEmail,
      idempotencyKey: `onboard-${key}-v1`,
      correlationId: `onboard-${key}`,
      actor: "platform:synthetic",
      reason: "Synthetic enterprise acceptance"
    } satisfies ProvisioningRequest
  };
}

function providerContext(cell: CustomerCellRecord) {
  return {
    cellId: cell.id,
    cellKey: cell.cellKey,
    correlationId: `restore-${cell.cellKey}`,
    idempotencyKey: `restore-${cell.cellKey}`,
    leaseVersion: 1,
    fencingToken: `fence-${cell.cellKey}`,
    deadline: new Date(Date.now() + 60_000),
    signal: new AbortController().signal
  };
}

function required(value: string | undefined): string {
  if (!value) throw new Error("Synthetic provisioning evidence is incomplete");
  return value;
}
