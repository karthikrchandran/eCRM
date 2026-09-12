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

export type RuntimeConfig = { mode: "platform" } | {
  mode: "cell";
  cellId: string;
  cellKey: string;
  /** @deprecated accepted only for source compatibility; authorization ignores it. */
  lifecycleStatus?: "ACTIVE" | "SUSPENDED" | "OFFBOARDING" | "DELETED";
};

export function parseRuntimeConfig(input: Record<string, string | undefined>): RuntimeConfig {
  const { APP_MODE } = appModeSchema.parse(input);

  if (APP_MODE === "platform") {
    return { mode: "platform" };
  }

  return cellRuntimeConfigSchema.parse(input);
}

export function parseConfiguredRuntimeConfig(input: Record<string, string | undefined> = process.env): RuntimeConfig {
  if (!input.APP_MODE && input.NODE_ENV === "production") {
    throw new Error("APP_MODE must be explicit in production");
  }

  return parseRuntimeConfig({
    ...input,
    APP_MODE: input.APP_MODE ?? "platform"
  });
}

export async function isCellRuntimeActive(
  runtime: RuntimeConfig,
  loadProjection: (cellId: string) => Promise<{ cellId: string; lifecycleStatus: string } | undefined>
): Promise<boolean> {
  if (runtime.mode !== "cell") return true;
  const projection = await loadProjection(runtime.cellId);
  return projection?.cellId === runtime.cellId && projection.lifecycleStatus === "ACTIVE";
}

export async function isConfiguredCellRuntimeActive(
  input: Record<string, string | undefined> = process.env,
  loadProjection?: (cellId: string) => Promise<{ cellId: string; lifecycleStatus: string } | undefined>
): Promise<boolean> {
  const runtime = parseConfiguredRuntimeConfig(input);
  if (runtime.mode !== "cell") return true;
  const loader = loadProjection ?? (async (cellId: string) => {
    const { db } = await import("@/server/db");
    return (await db.cellControlProjection.findUnique({
      where: { cellId }, select: { cellId: true, lifecycleStatus: true }
    })) ?? undefined;
  });
  return isCellRuntimeActive(runtime, loader);
}
