import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { buildSearchText, mapSharedRecordRow } from "./mappers";
import { sharedRecordUpsertSchema } from "./validators";
import type { SharedBusinessRecordRow, SharedRecordMutationResult, SharedRecordUpsertInput } from "./types";

type SharedRecordMutationDb = {
  sharedBusinessRecord: {
    create: (args: Prisma.SharedBusinessRecordCreateArgs) => Promise<SharedBusinessRecordRow>;
    findFirst: (args: Prisma.SharedBusinessRecordFindFirstArgs) => Promise<SharedBusinessRecordRow | null>;
    update: (args: Prisma.SharedBusinessRecordUpdateArgs) => Promise<SharedBusinessRecordRow>;
  };
};

function toRecordData(input: SharedRecordUpsertInput) {
  const searchText = buildSearchText({
    displayName: input.displayName,
    status: input.status,
    email: input.email ?? null,
    phone: input.phone ?? null,
    companyName: input.companyName ?? null,
    externalKey: input.externalKey ?? null,
    ecrmLegacyId: input.ecrmLegacyId ?? null,
    emailVoiceLegacyId: input.emailVoiceLegacyId ?? null
  });

  return {
    entityType: input.entityType,
    displayName: input.displayName,
    status: input.status,
    ownerId: input.ownerId,
    parentId: input.parentId,
    relatedLeadId: input.relatedLeadId,
    relatedCustomerId: input.relatedCustomerId,
    relatedContactId: input.relatedContactId,
    relatedOpportunityId: input.relatedOpportunityId,
    sourceApp: input.sourceApp,
    ecrmLegacyId: input.ecrmLegacyId,
    emailVoiceLegacyId: input.emailVoiceLegacyId,
    externalKey: input.externalKey,
    email: input.email,
    phone: input.phone,
    companyName: input.companyName,
    searchText,
    data: input.data
  };
}

export async function upsertSharedRecord(
  rawInput: unknown,
  database: SharedRecordMutationDb = db as unknown as SharedRecordMutationDb
): Promise<SharedRecordMutationResult> {
  const input = sharedRecordUpsertSchema.parse(rawInput) as SharedRecordUpsertInput;

  const existingByEcrmLegacyId = input.ecrmLegacyId
    ? await database.sharedBusinessRecord.findFirst({
        where: {
          entityType: input.entityType,
          ecrmLegacyId: input.ecrmLegacyId
        }
      })
    : null;

  const existing =
    existingByEcrmLegacyId ??
    (input.emailVoiceLegacyId
      ? await database.sharedBusinessRecord.findFirst({
          where: {
            entityType: input.entityType,
            emailVoiceLegacyId: input.emailVoiceLegacyId
          }
        })
      : null);

  const data = toRecordData(input);

  if (existing) {
    const row = await database.sharedBusinessRecord.update({
      where: { id: existing.id },
      data
    });

    return { record: mapSharedRecordRow(row), created: false };
  }

  const row = await database.sharedBusinessRecord.create({
    data
  });

  return { record: mapSharedRecordRow(row), created: true };
}
