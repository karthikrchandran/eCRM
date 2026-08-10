export type TenantFixture = {
  readonly organizationId: string;
  readonly leadName: string;
  readonly contactEmail: string;
};

export function tenantFixture(tenantKey: string): TenantFixture {
  return {
    organizationId: `test-organization-${tenantKey}`,
    leadName: "Synthetic Enterprise Lead",
    contactEmail: "enterprise-lead@example.com",
  };
}
