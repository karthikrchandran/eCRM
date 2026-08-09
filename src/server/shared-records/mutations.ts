import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { withOrganization } from "@/server/organizations/with-organization";
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

function toRecordData(organizationId: string, input: SharedRecordUpsertInput) {
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
    organizationId,
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

function isPrismaUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

async function findExistingSharedRecord(organizationId: string, input: SharedRecordUpsertInput, database: SharedRecordMutationDb) {
  if (input.ecrmLegacyId) {
    const existingByEcrmLegacyId = await database.sharedBusinessRecord.findFirst({
      where: {
        organizationId,
        entityType: input.entityType,
        ecrmLegacyId: input.ecrmLegacyId
      }
    });

    if (existingByEcrmLegacyId) {
      return existingByEcrmLegacyId;
    }
  }

  if (input.emailVoiceLegacyId) {
    const existingByEmailVoiceLegacyId = await database.sharedBusinessRecord.findFirst({
      where: {
        organizationId,
        entityType: input.entityType,
        emailVoiceLegacyId: input.emailVoiceLegacyId
      }
    });

    if (existingByEmailVoiceLegacyId) {
      return existingByEmailVoiceLegacyId;
    }
  }

  if (input.externalKey) {
    return database.sharedBusinessRecord.findFirst({
      where: {
        organizationId,
        entityType: input.entityType,
        externalKey: input.externalKey
      }
    });
  }

  return null;
}

export async function upsertSharedRecord(
  organizationId: string,
  rawInput: unknown,
  database: SharedRecordMutationDb = db as unknown as SharedRecordMutationDb
): Promise<SharedRecordMutationResult> {
  if (database === (db as unknown as SharedRecordMutationDb)) {
    return withOrganization(organizationId, (tx) => upsertSharedRecord(organizationId, rawInput, tx as unknown as SharedRecordMutationDb));
  }
  const input = sharedRecordUpsertSchema.parse(rawInput) as SharedRecordUpsertInput;
  if (input.parentId) {
    const parent = await database.sharedBusinessRecord.findFirst({
      where: { id: input.parentId, organizationId }
    });
    if (!parent) throw new Error("Related record was not found.");
  }
  const existing = await findExistingSharedRecord(organizationId, input, database);
  const data = toRecordData(organizationId, input);

  if (existing) {
    const row = await database.sharedBusinessRecord.update({
      where: { id: existing.id },
      data
    });

    return { record: mapSharedRecordRow(row), created: false };
  }

  try {
    const row = await database.sharedBusinessRecord.create({
      data
    });

    return { record: mapSharedRecordRow(row), created: true };
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) {
      throw error;
    }

    const duplicate = await findExistingSharedRecord(organizationId, input, database);

    if (!duplicate) {
      throw error;
    }

    const row = await database.sharedBusinessRecord.update({
      where: { id: duplicate.id },
      data
    });

    return { record: mapSharedRecordRow(row), created: false };
  }
}
