import { ProductionBoard } from "@/components/production/production-board";
import { requireUser } from "@/server/auth/current-user";
import { canManageAdminSettings } from "@/server/auth/permissions";
import { updateProductionStageStatusAction } from "@/server/production/actions";
import { listProductionFormOptions, listProductionWorkItems } from "@/server/production/queries";

export default async function ProductionPage() {
  const user = await requireUser();
  const [workItems, options] = await Promise.all([listProductionWorkItems(user), listProductionFormOptions()]);

  return (
    <ProductionBoard
      canManageConfig={canManageAdminSettings(user.role)}
      owners={options.owners}
      stageAction={updateProductionStageStatusAction}
      workItems={workItems}
    />
  );
}
