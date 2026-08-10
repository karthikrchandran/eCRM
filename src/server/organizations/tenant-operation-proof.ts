export type TenantStateRow = { row: string };
export type ExactEvidence = { path: readonly string[]; value: unknown };

function isEmptyResult(result: unknown) {
  if (result === null || result === undefined) return true;
  if (Array.isArray(result)) return result.length === 0;
  if (typeof result === "object") return Object.keys(result).length === 0;
  return false;
}

function valuesAtPath(value: unknown, path: readonly string[]): unknown[] {
  if (path.length === 0) return [value];
  const [segment, ...rest] = path;
  if (segment === "**") {
    const direct = valuesAtPath(value, rest);
    if (Array.isArray(value)) return [...direct, ...value.flatMap((item) => valuesAtPath(item, path))];
    if (value && typeof value === "object") return [...direct, ...Object.values(value).flatMap((item) => valuesAtPath(item, path))];
    return direct;
  }
  if (segment === "*") {
    if (Array.isArray(value)) return value.flatMap((item) => valuesAtPath(item, rest));
    if (value && typeof value === "object") return Object.values(value).flatMap((item) => valuesAtPath(item, rest));
    return [];
  }
  if (!value || typeof value !== "object" || !(segment! in value)) return [];
  return valuesAtPath((value as Record<string, unknown>)[segment!], rest);
}

function matchesEvidence(value: unknown, evidence: readonly ExactEvidence[]) {
  return evidence.length > 0 && evidence.every(({ path, value: expected }) =>
    valuesAtPath(value, path).some((actual) => Object.is(actual, expected))
  );
}

export function resultHasExactEvidence(result: unknown, evidence: readonly ExactEvidence[]) {
  return !isEmptyResult(result) && matchesEvidence(result, evidence);
}

function parseRow(row: TenantStateRow) {
  return JSON.parse(row.row) as unknown;
}

function matchingRows(rows: readonly TenantStateRow[], evidence: readonly ExactEvidence[]) {
  return rows.filter((row) => matchesEvidence(parseRow(row), evidence));
}

export function hasCreatedRow(
  before: readonly TenantStateRow[],
  after: readonly TenantStateRow[],
  expectedIdentity: readonly ExactEvidence[]
) {
  const hasModelIdentity = expectedIdentity.some(({ path }) => path.join(".") !== "organizationId");
  return hasModelIdentity && after.length === before.length + 1 &&
    matchingRows(before, expectedIdentity).length === 0 &&
    matchingRows(after, expectedIdentity).length === 1;
}

export function hasDuplicateBusinessKey(
  beforeA: readonly TenantStateRow[],
  afterA: readonly TenantStateRow[],
  beforeB: readonly TenantStateRow[],
  afterB: readonly TenantStateRow[],
  expectedAKey: readonly ExactEvidence[],
  expectedBKey: readonly ExactEvidence[]
) {
  const matchingBeforeB = matchingRows(beforeB, expectedBKey);
  const matchingAfterB = matchingRows(afterB, expectedBKey);
  return afterA.length === beforeA.length + 1 &&
    matchingRows(beforeA, expectedAKey).length === 0 &&
    matchingRows(afterA, expectedAKey).length === 1 &&
    matchingBeforeB.length === 1 && matchingAfterB.length === 1 &&
    matchingAfterB[0]!.row === matchingBeforeB[0]!.row;
}
