export const tenantIsolationDomains = [
  "crm",
  "sales-day",
  "pipeline-opportunities",
  "products-proposals",
  "orders-production",
  "finance-incentives",
  "reports",
  "shared-export",
  "workflow"
] as const;

export const tenantIsolationCategories = [
  "list",
  "direct-id",
  "search",
  "aggregate",
  "create",
  "update",
  "delete",
  "foreign-attachment",
  "nested-include",
  "duplicate-identifier"
] as const;

export type TenantIsolationDomain = (typeof tenantIsolationDomains)[number];
export type TenantIsolationCategory = (typeof tenantIsolationCategories)[number];
export type TenantIsolationOperation = () => Promise<void>;
export type TenantIsolationAdapter = Record<TenantIsolationCategory, TenantIsolationOperation>;
export type TenantIsolationAdapters = Record<TenantIsolationDomain, TenantIsolationAdapter>;

type ExecutableScenario = {
  kind: "executable";
  evidence: string;
  run: (adapters: TenantIsolationAdapters) => Promise<void>;
};

export type ReviewedNotApplicableScenario = {
  kind: "reviewed-na";
  reason: string;
  equivalentOperation: TenantIsolationCategory;
  run: (adapters: TenantIsolationAdapters) => Promise<void>;
};

export type TenantIsolationScenario = ExecutableScenario | ReviewedNotApplicableScenario;
export type TenantIsolationDomainMatrix = Record<TenantIsolationCategory, TenantIsolationScenario>;

function executable(
  domain: TenantIsolationDomain,
  category: TenantIsolationCategory,
  evidence: string
): ExecutableScenario {
  return {
    kind: "executable",
    evidence,
    async run(adapters) {
      const operation = adapters[domain]?.[category];
      if (typeof operation !== "function") {
        throw new Error(`Missing executable tenant-isolation scenario: ${domain}:${category}`);
      }
      await operation();
    }
  };
}

function reviewedNotApplicable(
  domain: TenantIsolationDomain,
  category: TenantIsolationCategory,
  reason: string,
  equivalentOperation: TenantIsolationCategory
): ReviewedNotApplicableScenario {
  return {
    kind: "reviewed-na",
    reason,
    equivalentOperation,
    async run(adapters) {
      const operation = adapters[domain]?.[equivalentOperation];
      if (typeof operation !== "function") {
        throw new Error(`Missing executable tenant-isolation equivalent: ${domain}:${category}->${equivalentOperation}`);
      }
      await operation();
    }
  };
}

function domainMatrix(domain: TenantIsolationDomain): TenantIsolationDomainMatrix {
  return {
    list: executable(domain, "list", "Tenant A lists only its rows."),
    "direct-id": executable(domain, "direct-id", "Tenant A cannot load tenant B's identifier."),
    search: executable(domain, "search", "A shared search marker returns only tenant A rows."),
    aggregate: executable(domain, "aggregate", "Tenant A aggregates exclude tenant B rows."),
    create: executable(domain, "create", "Tenant A cannot create a tenant B-owned row."),
    update: executable(domain, "update", "Tenant A cannot update tenant B's row."),
    delete: executable(domain, "delete", "Tenant A cannot delete tenant B's row."),
    "foreign-attachment": executable(domain, "foreign-attachment", "Tenant A cannot attach work to tenant B's parent."),
    "nested-include": executable(domain, "nested-include", "Nested data loaded by tenant A excludes tenant B."),
    "duplicate-identifier": executable(domain, "duplicate-identifier", "The same business identifier can exist in A and B without cross-tenant visibility.")
  };
}

export const tenantIsolationMatrix = {
  crm: domainMatrix("crm"),
  "sales-day": domainMatrix("sales-day"),
  "pipeline-opportunities": domainMatrix("pipeline-opportunities"),
  "products-proposals": domainMatrix("products-proposals"),
  "orders-production": domainMatrix("orders-production"),
  "finance-incentives": domainMatrix("finance-incentives"),
  reports: {
    ...domainMatrix("reports"),
    create: reviewedNotApplicable("reports", "create", "Reports are read-only; aggregate isolation is the equivalent security boundary.", "aggregate"),
    update: reviewedNotApplicable("reports", "update", "Reports are read-only; aggregate isolation is the equivalent security boundary.", "aggregate"),
    delete: reviewedNotApplicable("reports", "delete", "Reports are read-only; aggregate isolation is the equivalent security boundary.", "aggregate"),
    "foreign-attachment": reviewedNotApplicable("reports", "foreign-attachment", "Reports accept filters, not foreign-key attachments; direct-ID denial is equivalent.", "direct-id")
  },
  "shared-export": domainMatrix("shared-export"),
  workflow: {
    ...domainMatrix("workflow"),
    update: reviewedNotApplicable("workflow", "update", "Workflow events are append-only; direct-ID denial is the equivalent boundary.", "direct-id"),
    delete: reviewedNotApplicable("workflow", "delete", "Workflow events are append-only; list isolation is the equivalent boundary.", "list"),
    "nested-include": reviewedNotApplicable("workflow", "nested-include", "Workflow events expose no nested child relation; list isolation is equivalent.", "list")
  }
} satisfies Record<TenantIsolationDomain, TenantIsolationDomainMatrix>;

export type TenantIsolationExecution = {
  domain: TenantIsolationDomain;
  category: TenantIsolationCategory;
  disposition: TenantIsolationScenario["kind"];
};

export async function executeTenantIsolationMatrix(
  adapters: TenantIsolationAdapters
): Promise<TenantIsolationExecution[]> {
  const executions: TenantIsolationExecution[] = [];

  for (const domain of tenantIsolationDomains) {
    for (const category of tenantIsolationCategories) {
      const scenario = tenantIsolationMatrix[domain]?.[category];
      if (!scenario || typeof scenario.run !== "function") {
        throw new Error(`Missing tenant-isolation matrix cell: ${domain}:${category}`);
      }
      await scenario.run(adapters);
      executions.push({ category, disposition: scenario.kind, domain });
    }
  }

  return executions;
}
