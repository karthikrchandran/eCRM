import Link from "next/link";

type ProductServiceRow = {
  id: string;
  name: string;
  code?: string | null;
  category: string;
  defaultGstRateBps: number;
  defaultProductionTemplateKey?: string | null;
  active: boolean;
  sortOrder: number;
};

type ProductServiceListProps = {
  products: ProductServiceRow[];
  toggleActiveAction: (productServiceId: string, active: boolean) => Promise<void>;
};

function formatGst(rateBps: number) {
  const percent = rateBps / 100;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(2)}%`;
}

export function ProductServiceList({ products, toggleActiveAction }: ProductServiceListProps) {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Products and services</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Admin catalog defaults for proposal line items.</p>
        </div>
        <Link className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white" href="/admin/products/new">
          New product/service
        </Link>
      </header>

      {products.length === 0 ? (
        <p className="surface p-6 text-sm text-[var(--muted)]">No products or services have been created yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Product/service</th>
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">GST</th>
                <th className="px-4 py-3 font-semibold">Template</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const nextActive = !product.active;
                const action = toggleActiveAction.bind(null, product.id, nextActive);

                return (
                  <tr className="border-t border-[var(--border)]" key={product.id}>
                    <td className="px-4 py-4 align-top">
                      <Link className="font-semibold text-[var(--accent-strong)] hover:underline" href={`/admin/products/${product.id}/edit`}>
                        {product.name}
                      </Link>
                      <p className="mt-1 text-xs text-[var(--muted)]">Sort {product.sortOrder}</p>
                    </td>
                    <td className="px-4 py-4 align-top text-[var(--muted)]">{product.code || "No code"}</td>
                    <td className="px-4 py-4 align-top">{product.category}</td>
                    <td className="px-4 py-4 align-top">{formatGst(product.defaultGstRateBps)}</td>
                    <td className="px-4 py-4 align-top text-[var(--muted)]">
                      {product.defaultProductionTemplateKey || "No template"}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span
                        className={`rounded px-2 py-1 text-xs font-semibold ${
                          product.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {product.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <form action={action}>
                        <button className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold" type="submit">
                          {product.active ? `Deactivate ${product.name}` : `Reactivate ${product.name}`}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
