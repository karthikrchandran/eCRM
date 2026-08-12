import { db } from "@/server/db";
import { getServerEnv } from "@/server/env";
import type { RuntimeConfig } from "@/server/runtime/cell-config";
import { cellModules, type CellModule } from "./module-catalog";

export type { CellModule } from "./module-catalog";

export class CellModuleAccessDeniedError extends Error {
  public constructor(module: CellModule) {
    super(`Module ${module} is not enabled`);
    this.name = "CellModuleAccessDeniedError";
  }
}

export function assertCellModuleEnabled(
  runtime: RuntimeConfig,
  module: CellModule,
  enabledModules: string[] | undefined
): void {
  if (runtime.mode === "cell" && !enabledModules?.includes(module)) throw new CellModuleAccessDeniedError(module);
}

export async function getEnabledCellModules(runtime: RuntimeConfig = getServerEnv().runtime): Promise<string[]> {
  if (runtime.mode !== "cell") return [...cellModules];
  const configuration = await db.cellConfiguration.findUnique({
    where: { id: "default" },
    select: { enabledModules: true }
  });
  return configuration?.enabledModules ?? [];
}

export async function requireCellModule(module: CellModule): Promise<void> {
  const runtime = getServerEnv().runtime;
  assertCellModuleEnabled(runtime, module, await getEnabledCellModules(runtime));
}
