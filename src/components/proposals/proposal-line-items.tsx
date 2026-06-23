import type { ProductServiceRecord } from "@/server/products/queries";

type ProposalLineItemsProps = {
  currency: "INR" | "USD";
  products: ProductServiceRecord[];
};

function formatGst(rateBps: number) {
  return `${rateBps / 100}%`;
}

export function ProposalLineItems({ currency, products }: ProposalLineItemsProps) {
  const defaultProduct = products[0];
  const minorUnitLabel = currency === "USD" ? "cents" : "paise";

  return (
    <section className="grid gap-3">
      <div>
        <h2 className="text-lg font-semibold">Commercial line items</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {currency === "USD"
            ? "Choose a product/service, price the line in cents, and enter tax manually."
            : "Choose a product/service and price the line in paise for exact GST calculations."}
        </p>
      </div>
      <fieldset className="grid gap-4 rounded-md border border-[var(--border)] p-4">
        <legend className="px-1 text-sm font-semibold">Line 1</legend>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1.4fr_120px_160px_150px]">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Product or service
            <select className="crm-control" name="productServiceId" required>
              <option value="">Choose product/service</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} - {product.category}
                  {currency === "INR" ? ` - GST ${formatGst(product.defaultGstRateBps)}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Line description
            <input
              className="crm-control"
              defaultValue={defaultProduct?.description ?? ""}
              name="lineDescription"
              type="text"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Quantity
            <input className="crm-control" defaultValue={1} min={1} name="quantity" required type="number" />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Unit price ({minorUnitLabel})
            <input
              className="crm-control"
              defaultValue={0}
              min={0}
              name="unitPricePaisa"
              required
              type="number"
            />
          </label>

          {currency === "USD" ? (
            <label className="flex flex-col gap-1 text-sm font-medium">
              Manual tax amount ({minorUnitLabel})
              <input className="crm-control" defaultValue={0} min={0} name="manualTaxPaisa" required type="number" />
              <input name="gstRateBps" type="hidden" value={0} />
              <input name="gstOverrideReason" type="hidden" value="Manual USD tax" />
            </label>
          ) : (
            <label className="flex flex-col gap-1 text-sm font-medium">
              GST basis points
              <input
                className="crm-control"
                defaultValue={defaultProduct?.defaultGstRateBps ?? 1800}
                max={2800}
                min={0}
                name="gstRateBps"
                required
                type="number"
              />
            </label>
          )}
        </div>

        {currency === "INR" ? (
          <label className="flex flex-col gap-1 text-sm font-medium">
            GST override reason
            <input
              className="crm-control"
              name="gstOverrideReason"
              placeholder="Required when GST differs from the product default"
              type="text"
            />
          </label>
        ) : null}
      </fieldset>
    </section>
  );
}
