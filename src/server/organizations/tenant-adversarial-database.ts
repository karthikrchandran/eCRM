import type { Prisma, PrismaClient } from "@prisma/client";
import { withOrganization } from "./with-organization";
import type {
  TenantIsolationAdapter,
  TenantIsolationAdapters,
  TenantIsolationDomain
} from "./tenant-adversarial-matrix";

export type TenantDomainProbe = {
  table: string;
  labelColumn: string;
  rowA: string;
  rowB: string;
  parentTable: string;
  nestedTable?: string;
  nestedForeignKey?: string;
  createOverrides?: Record<string, string>;
};

type ControlDatabase = Pick<PrismaClient, "$queryRawUnsafe">;
type TenantDatabase = Pick<PrismaClient, "$transaction">;

type MatrixDatabaseInput = {
  control: ControlDatabase;
  marker: string;
  organizationA: string;
  organizationB: string;
  probes: Record<TenantIsolationDomain, TenantDomainProbe>;
  tenant: TenantDatabase;
};

function identifier(value: string): string {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(value)) {
    throw new Error(`Unsafe tenant matrix SQL identifier: ${value}`);
  }
  return `"${value}"`;
}

function assertIds(actual: Array<{ id: string }>, expected: string[], scenario: string) {
  const actualIds = actual.map(({ id }) => id).sort();
  const expectedIds = [...expected].sort();
  if (actualIds.length !== expectedIds.length || actualIds.some((value, index) => value !== expectedIds[index])) {
    throw new Error(`${scenario}: expected [${expectedIds.join(", ")}], received [${actualIds.join(", ")}].`);
  }
}

function assertCount(actual: bigint | number, expected: number, scenario: string) {
  if (Number(actual) !== expected) {
    throw new Error(`${scenario}: expected ${expected}, received ${String(actual)}.`);
  }
}

async function expectRejected(work: () => Promise<unknown>, scenario: string) {
  try {
    await work();
  } catch {
    return;
  }
  throw new Error(`${scenario}: the cross-tenant write unexpectedly succeeded.`);
}

function createProbeAdapter(
  domain: TenantIsolationDomain,
  probe: TenantDomainProbe,
  input: MatrixDatabaseInput
): TenantIsolationAdapter {
  const table = identifier(probe.table);
  const label = identifier(probe.labelColumn);
  const parentTable = identifier(probe.parentTable);

  async function inTenantA(work: (transaction: Prisma.TransactionClient) => Promise<void>) {
    await withOrganization(input.organizationA, work, input.tenant);
  }

  async function list() {
    await inTenantA(async (transaction) => {
      const rows = await transaction.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM ${table} WHERE "id" = ANY($1::text[]) ORDER BY "id"`,
        [probe.rowA, probe.rowB]
      );
      assertIds(rows, [probe.rowA], `${domain}:list`);
    });
  }

  async function directId() {
    await inTenantA(async (transaction) => {
      const rows = await transaction.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM ${table} WHERE "id" = $1`,
        probe.rowB
      );
      assertIds(rows, [], `${domain}:direct-id`);
    });
  }

  async function search() {
    await inTenantA(async (transaction) => {
      const rows = await transaction.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM ${table} WHERE ${label} = $1 AND "id" = ANY($2::text[])`,
        input.marker,
        [probe.rowA, probe.rowB]
      );
      assertIds(rows, [probe.rowA], `${domain}:search`);
    });
  }

  async function aggregate() {
    await inTenantA(async (transaction) => {
      const rows = await transaction.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT count(*) AS "count" FROM ${table} WHERE "id" = ANY($1::text[])`,
        [probe.rowA, probe.rowB]
      );
      assertCount(rows[0]?.count ?? -1, 1, `${domain}:aggregate`);
    });
  }

  async function create() {
    const overrides = {
      id: `matrix_create_${domain.replaceAll("-", "_")}`,
      organizationId: input.organizationB,
      ...probe.createOverrides
    };
    await expectRejected(
      () => withOrganization(input.organizationA, async (transaction) => {
        await transaction.$executeRawUnsafe(
          `INSERT INTO ${table} SELECT (jsonb_populate_record(NULL::${table}, to_jsonb(source) || $1::jsonb)).* FROM ${table} source WHERE source."id" = $2`,
          JSON.stringify(overrides),
          probe.rowA
        );
      }, input.tenant),
      `${domain}:create`
    );
  }

  async function update() {
    await inTenantA(async (transaction) => {
      const rows = await transaction.$queryRawUnsafe<Array<{ id: string }>>(
        `UPDATE ${table} SET ${label} = ${label} WHERE "id" = $1 RETURNING "id"`,
        probe.rowB
      );
      assertIds(rows, [], `${domain}:update`);
    });
  }

  async function remove() {
    await inTenantA(async (transaction) => {
      const rows = await transaction.$queryRawUnsafe<Array<{ id: string }>>(
        `DELETE FROM ${table} WHERE "id" = $1 RETURNING "id"`,
        probe.rowB
      );
      assertIds(rows, [], `${domain}:delete`);
    });
  }

  async function foreignAttachment() {
    const controlRows = await input.control.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM ${parentTable} WHERE "id" = $1`,
      probe.rowB
    );
    assertIds(controlRows, [probe.rowB], `${domain}:foreign-attachment control precondition`);
    await inTenantA(async (transaction) => {
      const visibleParent = await transaction.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM ${parentTable} WHERE "id" = $1`,
        probe.rowB
      );
      assertIds(visibleParent, [], `${domain}:foreign-attachment parent lookup`);
    });

    if (probe.nestedTable && probe.nestedForeignKey) {
      const nestedTable = identifier(probe.nestedTable);
      const nestedForeignKey = identifier(probe.nestedForeignKey);
      const nestedRows = await input.control.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM ${nestedTable} WHERE ${nestedForeignKey} = $1 LIMIT 1`,
        probe.rowA
      );
      const sourceChildId = nestedRows[0]?.id;
      if (!sourceChildId) throw new Error(`${domain}:foreign-attachment fixture child is missing.`);
      await expectRejected(
        () => withOrganization(input.organizationA, async (transaction) => {
          await transaction.$executeRawUnsafe(
            `INSERT INTO ${nestedTable} SELECT (jsonb_populate_record(NULL::${nestedTable}, to_jsonb(source) || $1::jsonb)).* FROM ${nestedTable} source WHERE source."id" = $2`,
            JSON.stringify({
              id: `matrix_foreign_${domain.replaceAll("-", "_")}`,
              organizationId: input.organizationA,
              [probe.nestedForeignKey!]: probe.rowB
            }),
            sourceChildId
          );
        }, input.tenant),
        `${domain}:foreign-attachment write`
      );
    }
  }

  async function nestedInclude() {
    if (!probe.nestedTable || !probe.nestedForeignKey) {
      await directId();
      return;
    }
    const nestedTable = identifier(probe.nestedTable);
    const nestedForeignKey = identifier(probe.nestedForeignKey);
    await inTenantA(async (transaction) => {
      const rows = await transaction.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT parent."id" FROM ${table} parent JOIN ${nestedTable} child ON child.${nestedForeignKey} = parent."id" WHERE parent."id" = ANY($1::text[]) ORDER BY parent."id"`,
        [probe.rowA, probe.rowB]
      );
      assertIds(rows, [probe.rowA], `${domain}:nested-include`);
    });
  }

  async function duplicateIdentifier() {
    const controlRows = await input.control.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*) AS "count" FROM ${table} WHERE ${label} = $1 AND "id" = ANY($2::text[])`,
      input.marker,
      [probe.rowA, probe.rowB]
    );
    assertCount(controlRows[0]?.count ?? -1, 2, `${domain}:duplicate-identifier control precondition`);
    await search();
  }

  return {
    aggregate,
    create,
    delete: remove,
    "direct-id": directId,
    "duplicate-identifier": duplicateIdentifier,
    "foreign-attachment": foreignAttachment,
    list,
    "nested-include": nestedInclude,
    search,
    update
  };
}

export function createTenantDatabaseMatrixAdapters(input: MatrixDatabaseInput): TenantIsolationAdapters {
  return Object.fromEntries(
    (Object.entries(input.probes) as Array<[TenantIsolationDomain, TenantDomainProbe]>).map(([domain, probe]) => [
      domain,
      createProbeAdapter(domain, probe, input)
    ])
  ) as TenantIsolationAdapters;
}
