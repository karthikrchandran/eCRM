import type { SharedRecordType } from "./types";

type SharedRecordChangeType = "CREATE" | "UPDATE" | "ARCHIVE";

type BuildVersionLedgerEntryInput = {
  recordId: string;
  versionNumber: number;
  entityType: SharedRecordType;
  sourceApp: string;
  changeType: SharedRecordChangeType;
  snapshot: Record<string, unknown>;
  baseVersion?: number | null;
  idempotencyKey?: string | null;
};

type VersionedSharedRecordInput = {
  id: string;
  headVersion: number;
  displayName: string;
};

export function buildVersionLedgerEntry(input: BuildVersionLedgerEntryInput) {
  return {
    recordId: input.recordId,
    versionNumber: input.versionNumber,
    entityType: input.entityType,
    sourceApp: input.sourceApp,
    changeType: input.changeType,
    baseVersion: input.baseVersion ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    snapshot: input.snapshot,
    changedFields: {}
  };
}

export function toVersionedSharedRecord(input: VersionedSharedRecordInput) {
  return input;
}
