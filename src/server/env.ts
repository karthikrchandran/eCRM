import { z } from "zod";

import { parseRuntimeConfig, type RuntimeConfig } from "./runtime/cell-config";

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

  // Existing server-only callers predate runtime mode configuration. They remain
  // platform-mode callers until their deployment supplies APP_MODE explicitly.
  const runtime = parseRuntimeConfig({
    ...process.env,
    APP_MODE: process.env.APP_MODE ?? "platform"
  });

  return { ...serverEnv, runtime };
}
