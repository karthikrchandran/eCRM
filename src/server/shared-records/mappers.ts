import type { SharedBusinessRecordDto, SharedBusinessRecordRow } from "./types";

type SearchTextInput = {
  displayName: string;
  status: string;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  externalKey?: string | null;
  ecrmLegacyId?: string | null;
  emailVoiceLegacyId?: string | null;
};

export function buildSearchText(input: SearchTextInput) {
  return [
    input.displayName,
    input.status,
    input.email,
    input.phone,
    input.companyName,
    input.externalKey,
    input.ecrmLegacyId,
    input.emailVoiceLegacyId
  ]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

export function mapSharedRecordRow(row: SharedBusinessRecordRow): SharedBusinessRecordDto {
  return {
    ...row,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}
