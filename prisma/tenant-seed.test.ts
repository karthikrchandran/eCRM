import { describe, expect, it } from "vitest";

import { tenantSeedFixtures } from "./tenant-seed-fixtures";
import { seedTenant, validateTenantSeedEnvironment } from "./tenant-seed";

describe("tenant seed fixtures", () => {
  it("keeps the approved tenant identities isolated", () => {
    expect(Object.keys(tenantSeedFixtures)).toEqual(["ara-global", "ai-consulting"]);
    expect(tenantSeedFixtures["ara-global"].users.every((user) => user.email.endsWith("@ara-global.demo.local"))).toBe(true);
    expect(tenantSeedFixtures["ai-consulting"].users.every((user) => user.email.endsWith("@ai-consulting.demo.local"))).toBe(true);
    expect(tenantSeedFixtures["ara-global"].users.map((user) => user.name)).toEqual([
      "Karthik ARA Global",
      "Yamini ARA Global",
      "Padma ARA Global",
      "Atchaya ARA Global"
    ]);
    expect(tenantSeedFixtures["ai-consulting"].users.map((user) => user.name)).toEqual([
      "Karthik AI Consulting",
      "Aishwarya AI Consulting"
    ]);
    expect(tenantSeedFixtures["ara-global"].users.find((user) => user.name.includes("Karthik"))?.email).toBe("karthik@ara-global.demo.local");
    expect(tenantSeedFixtures["ai-consulting"].users.find((user) => user.name.includes("Karthik"))?.email).toBe("karthik@ai-consulting.demo.local");
    expect(new Set(Object.values(tenantSeedFixtures).flatMap((fixture) => fixture.users.map((user) => user.email))).size).toBe(6);
    expect(tenantSeedFixtures["ara-global"].demoLeadCustomers.every((lead) => lead.id.startsWith("ara_"))).toBe(true);
    expect(tenantSeedFixtures["ai-consulting"].demoLeadCustomers.every((lead) => lead.id.startsWith("aic_"))).toBe(true);
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

  it("rejects a cell id that does not belong to the selected tenant fixture", () => {
    expect(() => validateTenantSeedEnvironment({ ...valid, CELL_ID: "cell_ai_consulting" })).toThrow(
      "CELL_ID must match TENANT_SEED fixture"
    );
  });
});

function fakeClient(options: {
  projection?: { cellId: string };
  users?: Record<string, { id: string; name: string; email: string; passwordHash: string; role: "ADMIN" | "SALES"; active: boolean }>;
}) {
  const configUpserts: unknown[] = [];
  const userUpserts: unknown[] = [];
  const leadCustomerUpserts: unknown[] = [];
  const branchUpserts: unknown[] = [];
  const contactUpserts: unknown[] = [];
  const activityUpserts: unknown[] = [];
  const salesTargetUpserts: unknown[] = [];
  const client = {
    cellControlProjection: {
      findUnique: async () => options.projection ?? null,
      create: async (args: unknown) => {
        return (args as { data: { cellId: string } }).data;
      }
    },
    cellConfiguration: {
      upsert: async (args: unknown) => {
        configUpserts.push(args);
        return args;
      }
    },
    user: {
      findUnique: async ({ where }: { where: { email: string } }) => options.users?.[where.email] ?? null,
      upsert: async (args: unknown) => {
        userUpserts.push(args);
        const typedArgs = args as { where: { email: string }; update: { name?: string }; create: { name: string; email: string; passwordHash: string; role: "ADMIN" | "SALES"; active: boolean } };
        const existing = options.users?.[typedArgs.where.email];
        if (existing) return { ...existing, ...typedArgs.update };
        return { id: `created_${typedArgs.create.email}`, ...typedArgs.create };
      }
    },
    leadCustomer: {
      upsert: async (args: unknown) => {
        leadCustomerUpserts.push(args);
        return { id: (args as { where: { id: string } }).where.id };
      }
    },
    branch: {
      upsert: async (args: unknown) => {
        branchUpserts.push(args);
        return args;
      }
    },
    contact: {
      upsert: async (args: unknown) => {
        contactUpserts.push(args);
        return args;
      }
    },
    activity: {
      upsert: async (args: unknown) => {
        activityUpserts.push(args);
        return args;
      }
    },
    salesTarget: {
      upsert: async (args: unknown) => {
        salesTargetUpserts.push(args);
        return args;
      }
    }
  };
  return { client, configUpserts, userUpserts, leadCustomerUpserts, branchUpserts, contactUpserts, activityUpserts, salesTargetUpserts };
}

describe("seedTenant", () => {
  it("checks the persisted cell projection before writing configuration or users", async () => {
    const { client, configUpserts, userUpserts } = fakeClient({ projection: { cellId: "cell_wrong" } });

    await expect(seedTenant(client, tenantSeedFixtures["ara-global"], { adminPassword: "admin-secret", salesPassword: "sales-secret" }))
      .rejects.toThrow("Persisted cell identity does not match CELL_ID");
    expect(configUpserts).toHaveLength(0);
    expect(userUpserts).toHaveLength(0);
  });

  it("initializes a missing approved demo cell projection before seeding records", async () => {
    const araUsers = Object.fromEntries(tenantSeedFixtures["ara-global"].users.map((user, index) => [
      user.email,
      { id: `ara_user_${index}`, name: user.name, email: user.email, passwordHash: "hash", role: user.role, active: true }
    ]));
    const { client, leadCustomerUpserts } = fakeClient({ users: araUsers });

    await seedTenant(client, tenantSeedFixtures["ara-global"]);

    expect(leadCustomerUpserts).toHaveLength(4);
  });

  it("preserves existing password hash, active state, and role on rerun", async () => {
    const existingAdmin = {
      id: "admin-id",
      name: "Existing Admin",
      email: "karthik@ara-global.demo.local",
      passwordHash: "existing-hash",
      role: "SALES" as const,
      active: false
    };
    const { client, userUpserts } = fakeClient({
      projection: { cellId: "cell_ara_global" },
      users: { [existingAdmin.email]: existingAdmin }
    });

    await seedTenant(client, tenantSeedFixtures["ara-global"], { salesPassword: "sales-secret" });
    const existingCall = userUpserts.find((entry) => (entry as { where: { email: string } }).where.email === existingAdmin.email) as {
      update: Record<string, unknown>;
    };
    expect(existingCall.update).toEqual({ name: "Karthik ARA Global" });
    expect(existingCall.update).not.toHaveProperty("passwordHash");
    expect(existingCall.update).not.toHaveProperty("role");
    expect(existingCall.update).not.toHaveProperty("active");
  });

  it("requires operator-supplied passwords only for missing users", async () => {
    const { client, configUpserts, userUpserts } = fakeClient({ projection: { cellId: "cell_ara_global" } });

    await expect(seedTenant(client, tenantSeedFixtures["ara-global"], { salesPassword: "sales-secret" }))
      .rejects.toThrow("TENANT_SEED_ADMIN_PASSWORD is required");
    expect(configUpserts).toHaveLength(0);
    expect(userUpserts).toHaveLength(0);
  });

  it("creates tenant-specific demo records owned by users from the selected cell only", async () => {
    const araUsers = Object.fromEntries(tenantSeedFixtures["ara-global"].users.map((user, index) => [
      user.email,
      { id: `ara_user_${index}`, name: user.name, email: user.email, passwordHash: "hash", role: user.role, active: true }
    ]));
    const { client, leadCustomerUpserts, branchUpserts, contactUpserts, activityUpserts, salesTargetUpserts } = fakeClient({
      projection: { cellId: "cell_ara_global" },
      users: araUsers
    });

    await seedTenant(client, tenantSeedFixtures["ara-global"]);

    expect(leadCustomerUpserts).toHaveLength(4);
    expect(branchUpserts).toHaveLength(4);
    expect(contactUpserts).toHaveLength(4);
    expect(activityUpserts).toHaveLength(4);
    expect(salesTargetUpserts).toHaveLength(4);
    expect(JSON.stringify(leadCustomerUpserts)).toContain("ara_lead_orion_learning");
    expect(JSON.stringify(leadCustomerUpserts)).not.toContain("aic_");
    expect(JSON.stringify(leadCustomerUpserts)).toContain("ara_user_0");
  });
});
