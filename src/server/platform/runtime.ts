import { PrismaPlatformAdministrationRepository } from "./administration-db";
import { PlatformAdministrationService } from "./administration";
import { getPlatformDatabase, PrismaPlatformRepository } from "./db";
import { CustomerCellProvisioner } from "./provisioning";
import { ProductionCellProvider } from "./providers/production-driver";
import { HttpCellControlProjectionClient } from "./control-projection-client";
import { issueSupportAccessToken } from "@/server/cell-admin/support-access";

export function getPlatformAdministrationService(): PlatformAdministrationService {
  const database = getPlatformDatabase();
  return new PlatformAdministrationService(new PrismaPlatformAdministrationRepository(database), () => new Date(), {
    projectionSecret: process.env.CELL_CONTROL_PROJECTION_SECRET ?? "",
    projectionClient: new HttpCellControlProjectionClient(database),
    issueAccessToken: (grant) => issueSupportAccessToken(grant, process.env.SUPPORT_ACCESS_SECRET ?? "")
  });
}

export function getCustomerCellProvisioner(): CustomerCellProvisioner {
  const database = getPlatformDatabase();
  return new CustomerCellProvisioner(
    new PrismaPlatformRepository(database),
    new ProductionCellProvider({
      config: {
        databaseEndpoint: process.env.CELL_PROVIDER_DATABASE_ENDPOINT,
        databaseCredentialReference: process.env.CELL_PROVIDER_DATABASE_CREDENTIAL_REFERENCE,
        storageEndpoint: process.env.CELL_PROVIDER_STORAGE_ENDPOINT,
        storageCredentialReference: process.env.CELL_PROVIDER_STORAGE_CREDENTIAL_REFERENCE,
        secretEndpoint: process.env.CELL_PROVIDER_SECRET_ENDPOINT,
        secretCredentialReference: process.env.CELL_PROVIDER_SECRET_CREDENTIAL_REFERENCE,
        backupEndpoint: process.env.CELL_PROVIDER_BACKUP_ENDPOINT,
        backupCredentialReference: process.env.CELL_PROVIDER_BACKUP_CREDENTIAL_REFERENCE,
        applicationEndpoint: process.env.CELL_PROVIDER_APPLICATION_ENDPOINT,
        applicationCredentialReference: process.env.CELL_PROVIDER_APPLICATION_CREDENTIAL_REFERENCE,
        signalLoopEndpoint: process.env.CELL_PROVIDER_SIGNALLOOP_ENDPOINT,
        signalLoopCredentialReference: process.env.CELL_PROVIDER_SIGNALLOOP_CREDENTIAL_REFERENCE
      },
      adapters: {},
      safety: { idempotency: "provider-enforced", fencing: "provider-enforced", cancellation: "abort-signal" }
    })
  );
}
