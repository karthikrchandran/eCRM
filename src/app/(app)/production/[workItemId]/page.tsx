import { notFound } from "next/navigation";
import { ProductionDetail } from "@/components/production/production-detail";
import { requireUser } from "@/server/auth/current-user";
import { updateProductionStageStatusAction } from "@/server/production/actions";
import { getProductionWorkItemDetail, listProductionFormOptions } from "@/server/production/queries";

export default async function ProductionDetailPage({ params }: { params: Promise<{ workItemId: string }> }) {
  const user = await requireUser();
  const { workItemId } = await params;
  const [workItem, options] = await Promise.all([getProductionWorkItemDetail(user, workItemId), listProductionFormOptions()]);

  if (!workItem) {
    notFound();
  }

  const stageAction = updateProductionStageStatusAction.bind(null, workItem.id);

  return <ProductionDetail owners={options.owners} stageAction={stageAction} workItem={workItem} />;
}
