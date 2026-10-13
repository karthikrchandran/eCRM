import { notFound } from "next/navigation";
import { ProductionConfig } from "@/components/production/production-config";
import { requireUser } from "@/server/auth/current-user";
import { canManageAdminSettings } from "@/server/auth/permissions";
import { saveProductionTemplateStageAction } from "@/server/production/actions";
import { listProductionTemplateConfig } from "@/server/production/queries";

export default async function AdminProductionConfigPage() {
  const user = await requireUser("production");

  if (!canManageAdminSettings(user.role)) {
    notFound();
  }

  const config = await listProductionTemplateConfig(user);

  return (
    <ProductionConfig
      productServices={config.productServices}
      saveStageAction={saveProductionTemplateStageAction}
      templates={config.templates}
    />
  );
}
