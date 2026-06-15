import type { ProductServiceRecord } from "@/server/products/queries";

type ProposalLineItemsProps = {
  products: ProductServiceRecord[];
};

function formatGst(rateBps: number) {
  return `${rateBps / 100}%`;
}

export function ProposalLineItems({ products }: ProposalLineItemsProps) {
  const defaultProduct = products[0];

  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold">Line items</h2>
      <fieldset className="grid gap-4 rounded-md border border-[var(--border)] p-4">
        <legend className="px-1 text-sm font-semibold">Line 1</legend>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1.4fr_120px_160px_150px]">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Product or service
            <select className="rounded-md border border-[var(--border)] px-3 py-2" name="productServiceId" required>
              <option value="">Choose product/service</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} - {product.category} - GST {formatGst(product.defaultGstRateBps)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Line description
            <input
              className="rounded-md border border-[var(--border)] px-3 py-2"
              defaultValue={defaultProduct?.description ?? ""}
              name="lineDescription"
              type="text"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Quantity
            <input className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue={1} min={1} name="quantity" required type="number" />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Unit price paise
            <input
              className="rounded-md border border-[var(--border)] px-3 py-2"
              defaultValue={0}
              min={0}
              name="unitPricePaisa"
              required
              type="number"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            GST basis points
            <input
              className="rounded-md border border-[var(--border)] px-3 py-2"
              defaultValue={defaultProduct?.defaultGstRateBps ?? 1800}
              max={2800}
              min={0}
              name="gstRateBps"
              required
              type="number"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium">
          GST override reason
          <input
            className="rounded-md border border-[var(--border)] px-3 py-2"
            name="gstOverrideReason"
            placeholder="Required when GST differs from the product default"
            type="text"
          />
        </label>
      </fieldset>
    </section>
  );
}
