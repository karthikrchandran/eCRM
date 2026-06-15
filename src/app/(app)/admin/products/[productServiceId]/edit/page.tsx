import { notFound } from "next/navigation";
import { ProductServiceForm } from "@/components/products/product-service-form";
import { requireUser } from "@/server/auth/current-user";
import { updateProductServiceAction } from "@/server/products/actions";
import { getProductServiceForAdmin } from "@/server/products/queries";

export default async function EditProductServicePage({ params }: { params: Promise<{ productServiceId: string }> }) {
  const user = await requireUser();
  const { productServiceId } = await params;
  const product = await getProductServiceForAdmin(user, productServiceId);

  if (!product) {
    notFound();
  }

  const action = updateProductServiceAction.bind(null, product.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit product/service</h1>
      <ProductServiceForm action={action} initialValues={product} submitLabel="Save product/service" />
    </div>
  );
}
