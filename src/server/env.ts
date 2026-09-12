import { z } from "zod";

import { parseConfiguredRuntimeConfig, type RuntimeConfig } from "./runtime/cell-config";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().trim().min(1),
  AUTH_SECRET: z.string().min(32),
  APP_BASE_URL: z.string().url().default("http://localhost:3000")
});

export type ServerEnv = z.infer<typeof serverEnvSchema> & { runtime: RuntimeConfig };

export function getServerEnv(): ServerEnv {
  const serverEnv = serverEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    APP_BASE_URL: process.env.APP_BASE_URL
  });

  const runtime = parseConfiguredRuntimeConfig(process.env);

  return { ...serverEnv, runtime };
}
