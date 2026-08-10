export type TenantStateRow = { row: string };

function isEmptyResult(result: unknown) {
  if (result === null || result === undefined) return true;
  if (Array.isArray(result)) return result.length === 0;
  if (typeof result === "object") return Object.keys(result).length === 0;
  return false;
}

export function resultContainsIdentity(result: unknown, identity: string) {
  if (isEmptyResult(result)) return false;
  return JSON.stringify(result, (_key, value) => typeof value === "bigint" ? value.toString() : value).includes(identity);
}

function rowContainsEvery(row: TenantStateRow, fragments: readonly string[]) {
  return fragments.every((fragment) => row.row.includes(fragment));
}

export function hasCreatedRow(
  before: readonly TenantStateRow[],
  after: readonly TenantStateRow[],
  expectedFragments: readonly string[]
) {
  const newMatchingRows = after.filter((row) =>
    rowContainsEvery(row, expectedFragments) && !before.some((existing) => existing.row === row.row)
  );
  return after.length === before.length + 1 && newMatchingRows.length === 1;
}

export function hasDuplicateBusinessKey(
  beforeA: readonly TenantStateRow[],
  afterA: readonly TenantStateRow[],
  rowsB: readonly TenantStateRow[],
  expectedAFragments: readonly string[]
) {
  return !beforeA.some((row) => rowContainsEvery(row, expectedAFragments)) &&
    afterA.some((row) => rowContainsEvery(row, expectedAFragments)) &&
    rowsB.length > 0;
}
