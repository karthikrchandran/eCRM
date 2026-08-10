import type { OrganizationRole } from "@prisma/client";

type TenantMemberGuardDb = {
  $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export async function assertTenantMember(
  database: TenantMemberGuardDb,
  userId: string,
  roles: OrganizationRole[] = []
) {
  const rows = await database.$queryRaw<Array<{ allowed: boolean }>>`
    SELECT public.tenant_member_is_active(${userId}, ${roles.join(",")}) AS allowed
  `;
  if (rows[0]?.allowed !== true) {
    throw new Error("Organization member was not found.");
  }
}
