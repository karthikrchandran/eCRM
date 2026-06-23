import { BusinessSettingsForm } from "@/components/settings/business-settings-form";
import { PageHeader } from "@/components/ui/sales-primitives";
import { requireUser } from "@/server/auth/current-user";
import { getBusinessSettings } from "@/server/settings/settings";

export default async function AdminSettingsPage() {
  const user = await requireUser();
  const settings = await getBusinessSettings(user);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Business settings"
        description="Set the commercial defaults used by new proposals and finance workflows."
      />
      <BusinessSettingsForm settings={settings} />
    </div>
  );
}
