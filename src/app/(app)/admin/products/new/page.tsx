import { ProductServiceForm } from "@/components/products/product-service-form";
import { requireUser } from "@/server/auth/current-user";
import { createProductServiceAction } from "@/server/products/actions";

export default async function NewProductServicePage() {
  await requireUser();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New product/service</h1>
      <ProductServiceForm action={createProductServiceAction} submitLabel="Create product/service" />
    </div>
  );
}
