export const cellModules = ["crm", "proposals", "orders", "production", "finance", "reports"] as const;
export type CellModule = typeof cellModules[number];
