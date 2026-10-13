import { notFound } from "next/navigation";
import { ProductServiceList } from "@/components/products/product-service-list";
import { requireUser } from "@/server/auth/current-user";
import { canManageAdminSettings } from "@/server/auth/permissions";
import { setProductServiceActiveAction } from "@/server/products/actions";
import { listProductServicesForAdmin } from "@/server/products/queries";

export default async function AdminProductsPage() {
  const user = await requireUser("production");

  if (!canManageAdminSettings(user.role)) {
    notFound();
  }

  const products = await listProductServicesForAdmin(user);

  return <ProductServiceList products={products} toggleActiveAction={setProductServiceActiveAction} />;
}
