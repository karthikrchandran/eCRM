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
      .regex(/^[a-z0-9-]+$/, { error: "CELL_KEY must match ^[a-z0-9-]+$" })
  })
  .transform(({ CELL_ID, CELL_KEY }) => ({
    mode: "cell" as const,
    cellId: CELL_ID,
    cellKey: CELL_KEY
  }));

export type RuntimeConfig = { mode: "platform" } | { mode: "cell"; cellId: string; cellKey: string };

export function parseRuntimeConfig(input: Record<string, string | undefined>): RuntimeConfig {
  const { APP_MODE } = appModeSchema.parse(input);

  if (APP_MODE === "platform") {
    return { mode: "platform" };
  }

  return cellRuntimeConfigSchema.parse(input);
}
