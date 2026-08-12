import { z } from "zod";

const appModeSchema = z.object({
  APP_MODE: z.enum(["platform", "cell"], {
    error: "APP_MODE is required and must be either platform or cell"
  })
});

const cellRuntimeConfigSchema = z
  .object({
    APP_MODE: z.literal("cell"),
    CELL_ID: z.string({ error: "CELL_ID is required" }).trim().min(1, { error: "CELL_ID is required" }),
    CELL_KEY: z
      .string({ error: "CELL_KEY is required" })
      .regex(/^[a-z0-9-]+$/, { error: "CELL_KEY must match ^[a-z0-9-]+$" }),
    CELL_LIFECYCLE_STATUS: z.enum(["ACTIVE", "SUSPENDED", "OFFBOARDING", "DELETED"], {
      error: "CELL_LIFECYCLE_STATUS is required and must be ACTIVE, SUSPENDED, OFFBOARDING, or DELETED"
    })
  })
  .transform(({ CELL_ID, CELL_KEY, CELL_LIFECYCLE_STATUS }) => ({
    mode: "cell" as const,
    cellId: CELL_ID,
    cellKey: CELL_KEY,
    lifecycleStatus: CELL_LIFECYCLE_STATUS
  }));

export type RuntimeConfig = { mode: "platform" } | {
  mode: "cell";
  cellId: string;
  cellKey: string;
  lifecycleStatus: "ACTIVE" | "SUSPENDED" | "OFFBOARDING" | "DELETED";
};

export function parseRuntimeConfig(input: Record<string, string | undefined>): RuntimeConfig {
  const { APP_MODE } = appModeSchema.parse(input);

  if (APP_MODE === "platform") {
    return { mode: "platform" };
  }

  return cellRuntimeConfigSchema.parse(input);
}

export function isCellRuntimeActive(runtime: RuntimeConfig): boolean {
  return runtime.mode !== "cell" || runtime.lifecycleStatus === "ACTIVE";
}

export function isConfiguredCellRuntimeActive(input: Record<string, string | undefined> = process.env): boolean {
  return isCellRuntimeActive(parseRuntimeConfig({ ...input, APP_MODE: input.APP_MODE ?? "platform" }));
}
