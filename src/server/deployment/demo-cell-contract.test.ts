import { describe, expect, it } from "vitest";

import { validateDemoCellContract } from "./demo-cell-contract";

const baseAraEnv = {
  APP_MODE: "cell",
  CELL_ID: "cell_ara_global",
  CELL_KEY: "ara-global",
  TENANT_SEED: "ara-global",
  DATABASE_URL: "postgresql://postgres:secret@db.ara.supabase.co:5432/postgres",
  AUTH_SECRET: "a".repeat(32),
  APP_BASE_URL: "https://ecrm-ara-global-demo.vercel.app",
  AUTH_MODE: "oidc",
  BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_ara",
  INTEGRATION_DESTINATION_URL: "https://signalloop-ara.example.com",
  INTEGRATION_DESTINATION_INSTALLATION: "workspace_ara_global",
  INTEGRATION_DESTINATION_TOKEN: "signalloop-delivery-token"
};

describe("validateDemoCellContract", () => {
  it("accepts a complete ARA Global demo-cell contract", () => {
    const result = validateDemoCellContract(baseAraEnv);

    expect(result.ok).toBe(true);
    expect(result.cell).toEqual({
      key: "ara-global",
      cellId: "cell_ara_global",
      displayName: "ARA Global"
    });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("rejects cross-cell identity mixups before deployment or seeding", () => {
    const result = validateDemoCellContract({
      ...baseAraEnv,
      CELL_ID: "cell_ai_consulting"
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("CELL_ID must be cell_ara_global for ara-global.");
  });

  it("warns when durable Vercel Blob storage is not configured", () => {
    const { BLOB_READ_WRITE_TOKEN: _token, ...withoutBlob } = baseAraEnv;

    const result = validateDemoCellContract(withoutBlob);

    expect(result.ok).toBe(true);
    expect(result.warnings).toContain("BLOB_READ_WRITE_TOKEN is not configured; durable deployed voice-note audio storage is not proven.");
  });

  it("rejects production local-test auth for demo deployments", () => {
    const result = validateDemoCellContract({
      ...baseAraEnv,
      NODE_ENV: "production",
      AUTH_MODE: "local-test"
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("AUTH_MODE=local-test is not allowed when NODE_ENV=production.");
  });

  it("requires a complete SignalLoop destination when any destination setting is present", () => {
    const { INTEGRATION_DESTINATION_TOKEN: _token, ...missingToken } = baseAraEnv;

    const result = validateDemoCellContract(missingToken);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("INTEGRATION_DESTINATION_TOKEN is required when configuring SignalLoop delivery.");
  });
});
