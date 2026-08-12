import { notFound } from "next/navigation";
import { CellAdministrationPanel } from "@/components/settings/cell-administration-panel";
import { IntegrationDeliveryPanel } from "@/components/settings/integration-delivery-panel";
import { BusinessSettingsForm } from "@/components/settings/business-settings-form";
import { PageHeader } from "@/components/ui/sales-primitives";
import { requireUser } from "@/server/auth/current-user";
import { getCellAdministrationService } from "@/server/cell-admin/runtime";
import { getEnabledCellModules } from "@/server/cell-admin/module-access";
import { getServerEnv } from "@/server/env";
import { getIntegrationCredentialService, getIntegrationDeliveryRepository } from "@/server/integration-delivery/runtime";
import { getBusinessSettings } from "@/server/settings/settings";

export default async function AdminSettingsPage() {
  const user = await requireUser();
  if (getServerEnv().runtime.mode !== "cell" || user.role !== "ADMIN") notFound();
  const administration = getCellAdministrationService();
  const runtime = getServerEnv().runtime;
  const [settings, configuration, users, enabledModules] = await Promise.all([
    getBusinessSettings(user),
    administration.getConfiguration(user),
    administration.listUsers(user),
    getEnabledCellModules(runtime)
  ]);
  const integration = enabledModules.includes("crm") ? await Promise.all([
    getIntegrationCredentialService().list(user),
    getIntegrationDeliveryRepository().status(runtime.mode === "cell" ? runtime.cellId : ""),
    getIntegrationDeliveryRepository().deadLetters(runtime.mode === "cell" ? runtime.cellId : ""),
    getIntegrationDeliveryRepository().repairCandidates(runtime.mode === "cell" ? runtime.cellId : "")
  ]) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Customer-cell administration"
        description="Manage this cell's identity, included modules, business defaults, and local users."
      />
      <CellAdministrationPanel configuration={configuration} users={users} />
      {integration ? <IntegrationDeliveryPanel
        credentials={integration[0].map((credential) => ({ ...credential, expiresAt: credential.expiresAt.toISOString(), lastUsedAt: credential.lastUsedAt?.toISOString() ?? null, createdAt: undefined, updatedAt: undefined, rotatedAt: undefined, revokedAt: undefined, cellId: undefined }))}
        status={integration[1]}
        deadLetters={integration[2].map(({ id, attempts, errorCode }) => ({ id, attempts, errorCode }))}
        repairCandidates={integration[3].map(({ id, status, sourceCount, destinationCount }) => ({ id, status, sourceCount, destinationCount }))}
      /> : null}
      <BusinessSettingsForm settings={settings} />
    </div>
  );
}
