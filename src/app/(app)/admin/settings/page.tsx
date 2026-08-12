import { notFound } from "next/navigation";
import { CellAdministrationPanel } from "@/components/settings/cell-administration-panel";
import { BusinessSettingsForm } from "@/components/settings/business-settings-form";
import { PageHeader } from "@/components/ui/sales-primitives";
import { requireUser } from "@/server/auth/current-user";
import { getCellAdministrationService } from "@/server/cell-admin/runtime";
import { getServerEnv } from "@/server/env";
import { getBusinessSettings } from "@/server/settings/settings";

export default async function AdminSettingsPage() {
  const user = await requireUser();
  if (getServerEnv().runtime.mode !== "cell" || user.role !== "ADMIN") notFound();
  const administration = getCellAdministrationService();
  const [settings, configuration, users] = await Promise.all([
    getBusinessSettings(user),
    administration.getConfiguration(user),
    administration.listUsers(user)
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Customer-cell administration"
        description="Manage this cell's identity, included modules, business defaults, and local users."
      />
      <CellAdministrationPanel configuration={configuration} users={users} />
      <BusinessSettingsForm settings={settings} />
    </div>
  );
}
