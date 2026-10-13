import { ProductServiceForm } from "@/components/products/product-service-form";
import { requireUser } from "@/server/auth/current-user";
import { createProductServiceAction } from "@/server/products/actions";
import { getProductStageSetupForAdmin } from "@/server/products/queries";

export default async function NewProductServicePage() {
  const user = await requireUser("production");
  const stageSetup = await getProductStageSetupForAdmin(user);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New product/service</h1>
      <ProductServiceForm
        action={createProductServiceAction}
        selectedStages={stageSetup.selectedStages}
        stageOptions={stageSetup.stageOptions}
        submitLabel="Create product/service"
      />
    </div>
  );
}
