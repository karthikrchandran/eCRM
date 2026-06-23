import Link from "next/link";
import type { ProductionProductServiceConfigRecord, ProductionTemplateConfigRecord } from "@/server/production/queries";

type ProductionConfigProps = {
  productServices: ProductionProductServiceConfigRecord[];
  saveStageAction: (formData: FormData) => Promise<void>;
  saveTemplateAction: (formData: FormData) => Promise<void>;
  templates: ProductionTemplateConfigRecord[];
};

function templateNameForKey(templates: ProductionTemplateConfigRecord[], key: string | null) {
  if (!key) {
    return "No template";
  }

  return templates.find((template) => template.key === key)?.name ?? key;
}

export function ProductionConfig({ productServices, saveStageAction, saveTemplateAction, templates }: ProductionConfigProps) {
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Production configuration</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Admin template and stage settings.</p>
        </div>
        <Link className="crm-button crm-button-secondary text-sm" href="/admin/products">
          Products
        </Link>
      </header>

      <section className="surface p-5">
        <h2 className="text-lg font-semibold">New template</h2>
        <form action={saveTemplateAction} className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_2fr_auto_auto] lg:items-end">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Key
            <input className="crm-control" name="key" placeholder="video_shoot" required />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Name
            <input className="crm-control" name="name" placeholder="Video shoot" required />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Description
            <input className="crm-control" name="description" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Sort
            <input className="crm-control w-24" defaultValue="0" min="0" name="sortOrder" type="number" />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium lg:pb-3">
            <input defaultChecked name="active" type="checkbox" />
            Active
          </label>
          <div className="lg:col-span-5">
            <button className="crm-button crm-button-primary text-sm" type="submit">
              Save template
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Templates and stages</h2>
        {templates.map((template) => (
          <article className="overflow-hidden rounded-lg border border-[var(--border)] bg-white" key={template.id}>
            <form action={saveTemplateAction} className="grid gap-3 border-b border-[var(--border)] bg-slate-50 p-4 lg:grid-cols-[1fr_1fr_2fr_auto_auto_auto] lg:items-end">
              <input name="id" type="hidden" value={template.id} />
              <label className="flex flex-col gap-1 text-sm font-medium">
                Key
                <input className="crm-control" defaultValue={template.key} name="key" required />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Name
                <input className="crm-control" defaultValue={template.name} name="name" required />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Description
                <input className="crm-control" defaultValue={template.description ?? ""} name="description" />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Sort
                <input className="crm-control w-24" defaultValue={template.sortOrder} min="0" name="sortOrder" type="number" />
              </label>
              <label className="flex items-center gap-2 text-sm font-medium lg:pb-3">
                <input defaultChecked={template.active} name="active" type="checkbox" />
                Active
              </label>
              <button className="crm-button crm-button-secondary text-sm" type="submit">
                Save
              </button>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                <thead className="bg-white text-xs uppercase tracking-wide text-[var(--muted)]">
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
                  {template.stages.map((stage) => (
                    <tr className="border-t border-[var(--border)]" key={stage.id}>
                      <td className="px-4 py-3 align-top">
                        <form action={saveStageAction} className="contents" id={`stage-${stage.id}`}>
                          <input name="templateId" type="hidden" value={template.id} />
                          <input name="stageId" type="hidden" value={stage.id} />
                        </form>
                        <div className="grid gap-2">
                          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
                            Key
                            <input className="crm-control" defaultValue={stage.key} form={`stage-${stage.id}`} name="key" required />
                          </label>
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
                        <input
                          className="crm-control w-24"
                          defaultValue={stage.sortOrder}
                          form={`stage-${stage.id}`}
                          min="0"
                          name="sortOrder"
                          type="number"
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <input defaultChecked={stage.required} form={`stage-${stage.id}`} name="required" type="checkbox" />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <button className="crm-button crm-button-secondary text-sm" form={`stage-${stage.id}`} type="submit">
                          Save stage
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-[var(--border)] bg-slate-50">
                    <td className="px-4 py-3 align-top">
                      <form action={saveStageAction} className="contents" id={`new-stage-${template.id}`}>
                        <input name="templateId" type="hidden" value={template.id} />
                      </form>
                      <div className="grid gap-2">
                        <input className="crm-control" form={`new-stage-${template.id}`} name="key" placeholder="review" required />
                        <input className="crm-control" form={`new-stage-${template.id}`} name="name" placeholder="Review" required />
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <input className="crm-control" form={`new-stage-${template.id}`} name="description" />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <input className="crm-control w-28" form={`new-stage-${template.id}`} min="1" name="defaultDurationDays" type="number" />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <input className="crm-control w-24" defaultValue="0" form={`new-stage-${template.id}`} min="0" name="sortOrder" type="number" />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <input defaultChecked form={`new-stage-${template.id}`} name="required" type="checkbox" />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <button className="crm-button crm-button-primary text-sm" form={`new-stage-${template.id}`} type="submit">
                        Add stage
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        ))}
      </section>

      <section className="surface p-5">
        <h2 className="text-lg font-semibold">Product/service mappings</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Product/service</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Template</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {productServices.map((product) => (
                <tr className="border-t border-[var(--border)]" key={product.id}>
                  <td className="px-4 py-3 align-top">
                    <Link className="font-semibold text-[var(--accent-strong)] hover:underline" href={`/admin/products/${product.id}/edit`}>
                      {product.name}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--muted)]">{product.code || "No code"}</p>
                  </td>
                  <td className="px-4 py-3 align-top">{product.category}</td>
                  <td className="px-4 py-3 align-top">{templateNameForKey(templates, product.defaultProductionTemplateKey)}</td>
                  <td className="px-4 py-3 align-top">{product.active ? "Active" : "Inactive"}</td>
                  <td className="px-4 py-3 align-top">
                    <Link className="crm-button crm-button-secondary text-sm" href={`/admin/products/${product.id}/edit`}>
                      Edit product
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
