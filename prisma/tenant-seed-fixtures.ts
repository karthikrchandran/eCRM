export type TenantSeedKey = "ara-global" | "ai-consulting";

export type TenantSeedUser = {
  name: string;
  email: string;
  role: "ADMIN" | "SALES";
  /** Demo-only value. Production deployments must rotate credentials immediately. */
  defaultPassword: string;
};

export type TenantSeedFixture = {
  cellId: string;
  cellKey: TenantSeedKey;
  displayName: string;
  planCode: string;
  enabledModules: string[];
  allowedModules: string[];
  users: readonly TenantSeedUser[];
};

const demoModules = ["crm", "opportunities", "proposals", "orders", "production", "finance", "reports"];

export const tenantSeedFixtures: Record<TenantSeedKey, TenantSeedFixture> = {
  "ara-global": {
    cellId: "cell_ara_global",
    cellKey: "ara-global",
    displayName: "ARA Global",
    planCode: "ENTERPRISE",
    enabledModules: demoModules,
    allowedModules: demoModules,
    users: [
      { name: "ARA Global Admin", email: "admin@ara-global.demo.local", role: "ADMIN", defaultPassword: "DemoOnly-AraGlobal-Admin-2026!" },
      { name: "ARA Global Sales", email: "sales@ara-global.demo.local", role: "SALES", defaultPassword: "DemoOnly-AraGlobal-Sales-2026!" }
    ]
  },
  "ai-consulting": {
    cellId: "cell_ai_consulting",
    cellKey: "ai-consulting",
    displayName: "AI Consulting",
    planCode: "ENTERPRISE",
    enabledModules: demoModules,
    allowedModules: demoModules,
    users: [
      { name: "AI Consulting Admin", email: "admin@ai-consulting.demo.local", role: "ADMIN", defaultPassword: "DemoOnly-AIConsulting-Admin-2026!" },
      { name: "AI Consulting Sales", email: "sales@ai-consulting.demo.local", role: "SALES", defaultPassword: "DemoOnly-AIConsulting-Sales-2026!" }
    ]
  }
};
