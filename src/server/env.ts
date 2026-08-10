import { z } from "zod";

const serverEnvSchema = z.object({
  CONTROL_PLANE_DATABASE_URL: z.string().trim().min(1),
  TENANT_DATABASE_URL: z.string().trim().min(1),
  AUTH_SECRET: z.string().min(32),
  APP_BASE_URL: z.string().url().default("http://localhost:3000")
});

export function getServerEnv() {
  return serverEnvSchema.parse({
    CONTROL_PLANE_DATABASE_URL: process.env.CONTROL_PLANE_DATABASE_URL,
    TENANT_DATABASE_URL: process.env.TENANT_DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    APP_BASE_URL: process.env.APP_BASE_URL
  });
}
