import { z } from "zod";

import { parseRuntimeConfig, type RuntimeConfig } from "./runtime/cell-config";

const serverEnvSchema = z.object({
  CONTROL_PLANE_DATABASE_URL: z.string().trim().min(1),
  TENANT_DATABASE_URL: z.string().trim().min(1),
  AUTH_SECRET: z.string().min(32),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  AUTH_MODE: z.enum(["oidc", "local-test"]).default("local-test"),
  OIDC_ISSUER: z.string().url().optional(),
  OIDC_CLIENT_ID: z.string().trim().min(1).optional(),
  OIDC_CLIENT_SECRET: z.string().trim().min(1).optional(),
  OIDC_REDIRECT_URI: z.string().url().optional(),
  OIDC_AUDIENCE: z.string().trim().min(1).optional(),
  OIDC_SCOPES: z.string().trim().min(1).default("openid profile email"),
  OIDC_JWKS_URI: z.string().url().optional()
}).superRefine((env, context) => {
  if (env.AUTH_MODE === "local-test" && process.env.NODE_ENV === "production") {
    context.addIssue({ code: "custom", path: ["AUTH_MODE"], message: "local-test authentication is disabled in production." });
  }
  if (env.AUTH_MODE === "oidc") {
    for (const key of ["OIDC_ISSUER", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "OIDC_REDIRECT_URI", "OIDC_AUDIENCE"] as const) {
      if (!env[key]) context.addIssue({ code: "custom", path: [key], message: `${key} is required when AUTH_MODE=oidc.` });
    }
  }
});

export type ServerEnv = z.infer<typeof serverEnvSchema> & { runtime: RuntimeConfig };

export function getServerEnv(): ServerEnv {
  const serverEnv = serverEnvSchema.parse({
    CONTROL_PLANE_DATABASE_URL: process.env.CONTROL_PLANE_DATABASE_URL,
    TENANT_DATABASE_URL: process.env.TENANT_DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    APP_BASE_URL: process.env.APP_BASE_URL,
    AUTH_MODE: process.env.AUTH_MODE,
    OIDC_ISSUER: process.env.OIDC_ISSUER,
    OIDC_CLIENT_ID: process.env.OIDC_CLIENT_ID,
    OIDC_CLIENT_SECRET: process.env.OIDC_CLIENT_SECRET,
    OIDC_REDIRECT_URI: process.env.OIDC_REDIRECT_URI,
    OIDC_AUDIENCE: process.env.OIDC_AUDIENCE,
    OIDC_SCOPES: process.env.OIDC_SCOPES,
    OIDC_JWKS_URI: process.env.OIDC_JWKS_URI
  });

  // Existing server-only callers predate runtime mode configuration. They remain
  // platform-mode callers until their deployment supplies APP_MODE explicitly.
  const runtime = parseRuntimeConfig({
    ...process.env,
    APP_MODE: process.env.APP_MODE ?? "platform"
  });

  return { ...serverEnv, runtime };
}
