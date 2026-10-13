import Link from "next/link";
import type { ProductionProductServiceConfigRecord, ProductionTemplateConfigRecord } from "@/server/production/queries";

type ProductionConfigProps = {
  productServices: ProductionProductServiceConfigRecord[];
  saveStageAction: (formData: FormData) => Promise<void>;
  templates: ProductionTemplateConfigRecord[];
};

export function ProductionConfig({ productServices, saveStageAction, templates }: ProductionConfigProps) {
  const stageSet = templates[0];
  const stages = stageSet?.stages ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Product stages</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Define the production stages used when product work is created.
          </p>
        </div>
        <Link className="crm-button crm-button-secondary text-sm" href="/admin/products">
          Product definitions
        </Link>
      </header>

      <section className="surface p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Stages</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {productServices.length} product definitions can use this stage list.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Stage</th>
                <th className="px-4 py-3 font-semibold">Description</th>
                <th className="px-4 py-3 font-semibold">Duration</th>
                <th className="px-4 py-3 font-semibold">Sort</th>
                <th className="px-4 py-3 font-semibold">Required</th>
                <th className="px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((stage) => (
                <tr className="border-t border-[var(--border)]" key={stage.id}>
                  <td className="px-4 py-3 align-top">
                    <form action={saveStageAction} className="contents" id={`stage-${stage.id}`}>
                      {stageSet ? <input name="templateId" type="hidden" value={stageSet.id} /> : null}
                      <input name="stageId" type="hidden" value={stage.id} />
                      <input name="key" type="hidden" value={stage.key} />
                    </form>
                    <div className="grid gap-2">
                      <label className="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
                        Name
                        <input className="crm-control" defaultValue={stage.name} form={`stage-${stage.id}`} name="name" required />
                      </label>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <input className="crm-control" defaultValue={stage.description ?? ""} form={`stage-${stage.id}`} name="description" />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <input
                      className="crm-control w-28"
                      defaultValue={stage.defaultDurationDays ?? ""}
                      form={`stage-${stage.id}`}
                      min="1"
                      name="defaultDurationDays"
                      type="number"
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <input className="crm-control w-24" defaultValue={stage.sortOrder} form={`stage-${stage.id}`} min="0" name="sortOrder" type="number" />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <input defaultChecked={stage.required} form={`stage-${stage.id}`} name="required" type="checkbox" />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <button className="crm-button crm-button-secondary text-sm" form={`stage-${stage.id}`} type="submit">
                      Save
                    </button>
                  </td>
                </tr>
              ))}
              {stages.length === 0 ? (
                <tr className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 text-sm text-[var(--muted)]" colSpan={6}>
                    No stages yet. Add the first product stage below.
                  </td>
                </tr>
              ) : null}
              <tr className="border-t border-[var(--border)] bg-slate-50">
                <td className="px-4 py-3 align-top">
                  <form action={saveStageAction} className="contents" id="new-product-stage">
                    {stageSet ? <input name="templateId" type="hidden" value={stageSet.id} /> : null}
                  </form>
                  <div className="grid gap-2">
                    <input className="crm-control" form="new-product-stage" name="name" placeholder="Review" required />
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <input className="crm-control" form="new-product-stage" name="description" />
                </td>
                <td className="px-4 py-3 align-top">
                  <input className="crm-control w-28" form="new-product-stage" min="1" name="defaultDurationDays" type="number" />
                </td>
                <td className="px-4 py-3 align-top">
                  <input className="crm-control w-24" defaultValue="0" form="new-product-stage" min="0" name="sortOrder" type="number" />
                </td>
                <td className="px-4 py-3 align-top">
                  <input defaultChecked form="new-product-stage" name="required" type="checkbox" />
                </td>
                <td className="px-4 py-3 align-top">
                  <button className="crm-button crm-button-primary text-sm" form="new-product-stage" type="submit">
                    Add stage
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
