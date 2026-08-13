import { describe, expect, it } from "vitest";

import { tenantSeedFixtures } from "./tenant-seed-fixtures";
import { validateTenantSeedEnvironment } from "./tenant-seed";

describe("tenant seed fixtures", () => {
  it("keeps the approved tenant identities isolated", () => {
    expect(Object.keys(tenantSeedFixtures)).toEqual(["ara-global", "ai-consulting"]);
    expect(tenantSeedFixtures["ara-global"].users.every((user) => user.email.endsWith("@ara-global.demo.local"))).toBe(true);
    expect(tenantSeedFixtures["ai-consulting"].users.every((user) => user.email.endsWith("@ai-consulting.demo.local"))).toBe(true);
    expect(new Set(Object.values(tenantSeedFixtures).flatMap((fixture) => fixture.users.map((user) => user.email))).size).toBe(4);
  });
});

describe("validateTenantSeedEnvironment", () => {
  const valid = {
    APP_MODE: "cell",
    CELL_ID: "cell_ara_global",
    CELL_KEY: "ara-global",
    DATABASE_URL: "postgresql://demo:demo@localhost:5432/ara",
    TENANT_SEED: "ara-global"
  };

  it("accepts a complete cell runtime", () => {
    expect(validateTenantSeedEnvironment(valid)).toEqual({
      appMode: "cell",
      cellId: "cell_ara_global",
      cellKey: "ara-global",
      databaseUrl: valid.DATABASE_URL,
      tenantSeed: "ara-global"
    });
  });

  it.each([
    ["APP_MODE", { APP_MODE: "platform" }],
    ["CELL_ID", { CELL_ID: undefined }],
    ["CELL_KEY", { CELL_KEY: undefined }],
    ["DATABASE_URL", { DATABASE_URL: undefined }],
    ["TENANT_SEED", { TENANT_SEED: "unknown" }]
  ])("rejects invalid %s before database construction", (_field, override) => {
    expect(() => validateTenantSeedEnvironment({ ...valid, ...override })).toThrow();
  });
});
