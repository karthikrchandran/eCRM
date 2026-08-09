const categories = [
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

export const tenantIsolationMatrix = {
  crm: [...categories],
  "sales-day": [...categories],
  "pipeline-opportunities": [...categories],
  "products-proposals": [...categories],
  "orders-production": [...categories],
  "finance-incentives": [...categories],
  reports: [...categories],
  "shared-export": [...categories],
  workflow: [...categories]
} as const;
