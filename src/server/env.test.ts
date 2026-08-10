import { afterEach, describe, expect, it } from "vitest";

import { getServerEnv } from "./env";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("getServerEnv", () => {
  it("parses required server environment and defaults the app base URL", () => {
    delete process.env.DATABASE_URL;
    process.env.CONTROL_PLANE_DATABASE_URL = "postgresql://ecrm_control@localhost:54329/ecrm?schema=public";
    process.env.TENANT_DATABASE_URL = "postgresql://ecrm_runtime@localhost:54329/ecrm?schema=public";
    process.env.AUTH_SECRET = "replace-with-at-least-32-characters";
    delete process.env.APP_BASE_URL;

    expect(getServerEnv()).toEqual({
      CONTROL_PLANE_DATABASE_URL: "postgresql://ecrm_control@localhost:54329/ecrm?schema=public",
      TENANT_DATABASE_URL: "postgresql://ecrm_runtime@localhost:54329/ecrm?schema=public",
      AUTH_SECRET: "replace-with-at-least-32-characters",
      APP_BASE_URL: "http://localhost:3000",
      AUTH_MODE: "local-test",
      OIDC_ISSUER: undefined,
      OIDC_CLIENT_ID: undefined,
      OIDC_CLIENT_SECRET: undefined,
      OIDC_REDIRECT_URI: undefined,
      OIDC_AUDIENCE: undefined,
      OIDC_SCOPES: "openid profile email",
      OIDC_JWKS_URI: undefined
    });
  });

  it("rejects auth secrets shorter than 32 characters", () => {
    process.env.CONTROL_PLANE_DATABASE_URL = "postgresql://ecrm_control@localhost:54329/ecrm?schema=public";
    process.env.TENANT_DATABASE_URL = "postgresql://ecrm_runtime@localhost:54329/ecrm?schema=public";
    process.env.AUTH_SECRET = "short";
    process.env.APP_BASE_URL = "http://localhost:3000";

    expect(() => getServerEnv()).toThrow();
  });

  it("does not require or expose the schema-owner migration URL at runtime", () => {
    delete process.env.DATABASE_URL;
    process.env.CONTROL_PLANE_DATABASE_URL = "postgresql://ecrm_control@localhost:54329/ecrm?schema=public";
    process.env.AUTH_SECRET = "replace-with-at-least-32-characters";
    process.env.TENANT_DATABASE_URL = "postgresql://ecrm_runtime@localhost:54329/ecrm?schema=public";
    process.env.APP_BASE_URL = "http://localhost:3000";
    expect(getServerEnv()).not.toHaveProperty("DATABASE_URL");
  });

  it("rejects invalid app base URLs", () => {
    process.env.CONTROL_PLANE_DATABASE_URL = "postgresql://ecrm_control@localhost:54329/ecrm?schema=public";
    process.env.TENANT_DATABASE_URL = "postgresql://ecrm_runtime@localhost:54329/ecrm?schema=public";
    process.env.AUTH_SECRET = "replace-with-at-least-32-characters";
    process.env.APP_BASE_URL = "not-a-url";

    expect(() => getServerEnv()).toThrow();
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["blank", "   "]
  ])("rejects %s tenant database URLs", (_label, tenantDatabaseUrl) => {
    process.env.CONTROL_PLANE_DATABASE_URL = "postgresql://ecrm_control@localhost:54329/ecrm?schema=public";
    if (tenantDatabaseUrl === undefined) {
      delete process.env.TENANT_DATABASE_URL;
    } else {
      process.env.TENANT_DATABASE_URL = tenantDatabaseUrl;
    }
    process.env.AUTH_SECRET = "replace-with-at-least-32-characters";
    process.env.APP_BASE_URL = "http://localhost:3000";

    expect(() => getServerEnv()).toThrow();
  });

  it.each([["missing", undefined], ["empty", ""], ["blank", "   "]])(
    "rejects %s control-plane database URLs",
    (_label, controlUrl) => {
      process.env.DATABASE_URL = "postgresql://schema_owner@localhost:54329/ecrm?schema=public";
      process.env.TENANT_DATABASE_URL = "postgresql://tenant@localhost:54329/ecrm?schema=public";
      process.env.AUTH_SECRET = "replace-with-at-least-32-characters";
      if (controlUrl === undefined) delete process.env.CONTROL_PLANE_DATABASE_URL;
      else process.env.CONTROL_PLANE_DATABASE_URL = controlUrl;
      expect(() => getServerEnv()).toThrow();
    }
  );
});
