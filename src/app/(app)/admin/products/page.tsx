import { ProductServiceList } from "@/components/products/product-service-list";
import { requireUser } from "@/server/auth/current-user";
import { setProductServiceActiveAction } from "@/server/products/actions";
import { listProductServicesForAdmin } from "@/server/products/queries";

export default async function AdminProductsPage() {
  const user = await requireUser();
  const products = await listProductServicesForAdmin(user);

  return <ProductServiceList products={products} toggleActiveAction={setProductServiceActiveAction} />;
}
