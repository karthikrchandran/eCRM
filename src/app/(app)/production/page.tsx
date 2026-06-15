import { ProductionBoard } from "@/components/production/production-board";
import { requireUser } from "@/server/auth/current-user";
import { listProductionWorkItems } from "@/server/production/queries";

export default async function ProductionPage() {
  const user = await requireUser();
  const workItems = await listProductionWorkItems(user);

  return <ProductionBoard workItems={workItems} />;
}
