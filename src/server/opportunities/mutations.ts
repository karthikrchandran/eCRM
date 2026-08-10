import type { Prisma } from "@prisma/client";
import { tenantBoundary as db } from "@/server/organizations/tenant-boundary";
import { withOrganization } from "@/server/organizations/with-organization";
import { assertOrganizationUserEligible } from "@/server/organizations/member-options";
import { assertTenantMember } from "@/server/organizations/tenant-member-guard";
import { assertCanWriteOpportunities, type OpportunityUser } from "./permissions";
import type { OpportunityInput, OpportunitySplitInput, PipelineStageInput, SalesTargetInput } from "./types";

type IdResult = { id: string };

type OwnerDb = {
  $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

type LeadDb = {
  leadCustomer: {
    findFirst: (args: Prisma.LeadCustomerFindFirstArgs) => Promise<IdResult | null>;
  };
};

type BranchDb = {
  branch?: {
    findFirst: (args: Prisma.BranchFindFirstArgs) => Promise<IdResult | null>;
  };
};

type StageDb = {
  pipelineStage: {
    findFirst: (args: Prisma.PipelineStageFindFirstArgs) => Promise<IdResult | null>;
  };
};

type OpportunityTransactionDb = {
  opportunity: {
    create: (args: Prisma.OpportunityCreateArgs) => Promise<IdResult>;
  };
  opportunityOwnerSplit: {
    deleteMany: (args: Prisma.OpportunityOwnerSplitDeleteManyArgs) => Promise<unknown>;
    createMany: (args: Prisma.OpportunityOwnerSplitCreateManyArgs) => Promise<unknown>;
  };
};

type UpdateOpportunityTransactionDb = {
  opportunity: {
    update: (args: Prisma.OpportunityUpdateArgs) => Promise<IdResult>;
  };
  opportunityOwnerSplit: OpportunityTransactionDb["opportunityOwnerSplit"];
};

type CreateOpportunityDb = OwnerDb &
  LeadDb &
  BranchDb &
  StageDb & {
    opportunity: {
      create: (args: Prisma.OpportunityCreateArgs) => Promise<IdResult>;
    };
    opportunityOwnerSplit: OpportunityTransactionDb["opportunityOwnerSplit"];
    $transaction?: (callback: (tx: unknown) => Promise<IdResult>) => Promise<IdResult>;
  };

type UpdateOpportunityDb = OwnerDb &
  LeadDb &
  BranchDb &
  StageDb & {
    opportunity: {
      findFirst: (args: Prisma.OpportunityFindFirstArgs) => Promise<IdResult | null>;
      update: (args: Prisma.OpportunityUpdateArgs) => Promise<IdResult>;
    };
    opportunityOwnerSplit: OpportunityTransactionDb["opportunityOwnerSplit"];
    $transaction?: (callback: (tx: unknown) => Promise<IdResult>) => Promise<IdResult>;
  };

type MoveOpportunityDb = StageDb & {
  opportunity: {
    findFirst: (args: Prisma.OpportunityFindFirstArgs) => Promise<IdResult | null>;
    update: (args: Prisma.OpportunityUpdateArgs) => Promise<IdResult>;
  };
};

type TargetDb = OwnerDb & {
  salesTarget: {
    upsert: (args: Prisma.SalesTargetUpsertArgs) => Promise<IdResult>;
  };
};

type StageManagementDb = {
  pipelineStage: {
    upsert: (args: Prisma.PipelineStageUpsertArgs) => Promise<IdResult>;
  };
};

async function assertActiveOwner(database: OwnerDb, organizationId: string, ownerId: string) {
  void organizationId;
  await assertTenantMember(database, ownerId, ["ADMIN", "SALES"]);
}

async function assertLeadExists(database: LeadDb, organizationId: string, leadCustomerId: string) {
  const lead = await database.leadCustomer.findFirst({
    where: { id: leadCustomerId, organizationId },
    select: { id: true }
  });

  if (!lead) {
    throw new Error("Lead or customer was not found.");
  }
}

async function assertBranchBelongsToLead(database: BranchDb, organizationId: string, leadCustomerId: string, branchId: string) {
  const branch = await database.branch?.findFirst({
    where: { id: branchId, leadCustomerId, organizationId },
    select: { id: true }
  });

  if (!branch) {
    throw new Error("Choose a branch that belongs to this lead or customer.");
  }
}

async function assertActiveStage(database: StageDb, organizationId: string, stageId: string) {
  const stage = await database.pipelineStage.findFirst({
    where: { id: stageId, organizationId, active: true },
    select: { id: true }
  });

  if (!stage) {
    throw new Error("Choose an active pipeline stage.");
  }
}

async function assertValidSplits(database: OwnerDb, organizationId: string, splits: OpportunitySplitInput[]) {
  if (splits.length === 0) {
    return;
  }

  const total = splits.reduce((sum, split) => sum + split.percent, 0);

  if (total !== 100) {
    throw new Error("Split percentages must total 100.");
  }

  for (const split of splits) {
    if (!Number.isInteger(split.percent) || split.percent <= 0 || split.percent > 100) {
      throw new Error("Split percentages must be whole numbers from 1 to 100.");
    }

    await assertActiveOwner(database, organizationId, split.userId);
  }
}

function opportunityData(user: OpportunityUser, input: OpportunityInput) {
  return {
    organizationId: user.organizationId,
    leadCustomerId: input.leadCustomerId,
    branchId: input.branchId,
    stageId: input.stageId,
    ownerId: input.ownerId,
    title: input.title,
    productInterest: input.productInterest,
    estimatedValueInr: input.estimatedValueInr,
    probability: input.probability,
    lastReachAt: input.lastReachAt,
    nextFollowUpAt: input.nextFollowUpAt,
    notes: input.notes,
    updatedById: user.id
  };
}

export async function createOpportunity(
  user: OpportunityUser,
  input: OpportunityInput,
  splits: OpportunitySplitInput[] = [],
  database: CreateOpportunityDb = db as unknown as CreateOpportunityDb
): Promise<IdResult> {
  if (database === (db as unknown as CreateOpportunityDb)) {
    await assertOrganizationUserEligible(user.organizationId, input.ownerId, ["ADMIN", "SALES"]);
    for (const split of splits) await assertOrganizationUserEligible(user.organizationId, split.userId, ["ADMIN", "SALES"]);
    return withOrganization(user.organizationId, (tx) => createOpportunity(user, input, splits, tx as unknown as CreateOpportunityDb));
  }
  assertCanWriteOpportunities(user);
  await assertLeadExists(database, user.organizationId, input.leadCustomerId);
  await assertActiveOwner(database, user.organizationId, input.ownerId);
  await assertActiveStage(database, user.organizationId, input.stageId);
  await assertValidSplits(database, user.organizationId, splits);

  if (input.branchId) {
    await assertBranchBelongsToLead(database, user.organizationId, input.leadCustomerId, input.branchId);
  }

  const work = async (tx: unknown) => {
    const transaction = tx as OpportunityTransactionDb;
    const opportunity = await transaction.opportunity.create({
      data: {
        ...opportunityData(user, input),
        createdById: user.id
      }
    });

    if (splits.length > 0) {
      await transaction.opportunityOwnerSplit.createMany({
        data: splits.map((split) => ({
          organizationId: user.organizationId,
          opportunityId: opportunity.id,
          userId: split.userId,
          percent: split.percent
        }))
      });
    }

    return opportunity;
  };
  return database.$transaction ? database.$transaction(work) : work(database);
}

export async function updateOpportunity(
  user: OpportunityUser,
  opportunityId: string,
  input: OpportunityInput,
  splits: OpportunitySplitInput[] = [],
  database: UpdateOpportunityDb = db as unknown as UpdateOpportunityDb
): Promise<IdResult> {
  if (database === (db as unknown as UpdateOpportunityDb)) {
    await assertOrganizationUserEligible(user.organizationId, input.ownerId, ["ADMIN", "SALES"]);
    for (const split of splits) await assertOrganizationUserEligible(user.organizationId, split.userId, ["ADMIN", "SALES"]);
    return withOrganization(user.organizationId, (tx) => updateOpportunity(user, opportunityId, input, splits, tx as unknown as UpdateOpportunityDb));
  }
  assertCanWriteOpportunities(user);
  const existing = await database.opportunity.findFirst({
    where: { id: opportunityId, organizationId: user.organizationId },
    select: { id: true }
  });

  if (!existing) {
    throw new Error("Opportunity was not found.");
  }

  await assertLeadExists(database, user.organizationId, input.leadCustomerId);
  await assertActiveOwner(database, user.organizationId, input.ownerId);
  await assertActiveStage(database, user.organizationId, input.stageId);
  await assertValidSplits(database, user.organizationId, splits);

  if (input.branchId) {
    await assertBranchBelongsToLead(database, user.organizationId, input.leadCustomerId, input.branchId);
  }

  const work = async (tx: unknown) => {
    const transaction = tx as UpdateOpportunityTransactionDb;
    const opportunity = await transaction.opportunity.update({
      where: { id: opportunityId },
      data: opportunityData(user, input)
    });

    await transaction.opportunityOwnerSplit.deleteMany({ where: { opportunityId, organizationId: user.organizationId } });

    if (splits.length > 0) {
      await transaction.opportunityOwnerSplit.createMany({
        data: splits.map((split) => ({
          organizationId: user.organizationId,
          opportunityId,
          userId: split.userId,
          percent: split.percent
        }))
      });
    }

    return opportunity;
  };
  return database.$transaction ? database.$transaction(work) : work(database);
}

export async function moveOpportunityStage(
  user: OpportunityUser,
  opportunityId: string,
  stageId: string,
  database: MoveOpportunityDb = db as unknown as MoveOpportunityDb
): Promise<IdResult> {
  if (database === (db as unknown as MoveOpportunityDb)) return withOrganization(user.organizationId, (tx) => moveOpportunityStage(user, opportunityId, stageId, tx as unknown as MoveOpportunityDb));
  assertCanWriteOpportunities(user);
  await assertActiveStage(database, user.organizationId, stageId);

  const existing = await database.opportunity.findFirst({ where: { id: opportunityId, organizationId: user.organizationId }, select: { id: true } });
  if (!existing) throw new Error("Opportunity was not found.");

  return database.opportunity.update({
    where: { id: opportunityId },
    data: { stageId, updatedById: user.id }
  });
}

export async function upsertSalesTarget(
  user: OpportunityUser,
  input: SalesTargetInput,
  database: TargetDb = db as unknown as TargetDb
): Promise<IdResult> {
  if (database === (db as unknown as TargetDb)) {
    await assertOrganizationUserEligible(user.organizationId, input.ownerId, ["ADMIN", "SALES"]);
    return withOrganization(user.organizationId, (tx) => upsertSalesTarget(user, input, tx as unknown as TargetDb));
  }
  assertCanWriteOpportunities(user);
  await assertActiveOwner(database, user.organizationId, input.ownerId);

  return database.salesTarget.upsert({
    where: {
      organizationId_ownerId_financialYear_quarter: {
        organizationId: user.organizationId,
        ownerId: input.ownerId,
        financialYear: input.financialYear,
        quarter: input.quarter
      }
    },
    update: { targetValueInr: input.targetValueInr },
    create: {
      organizationId: user.organizationId,
      ownerId: input.ownerId,
      financialYear: input.financialYear,
      quarter: input.quarter,
      targetValueInr: input.targetValueInr,
      createdById: user.id
    }
  });
}

export async function upsertPipelineStage(
  user: OpportunityUser,
  input: PipelineStageInput,
  database: StageManagementDb = db as unknown as StageManagementDb
): Promise<IdResult> {
  if (database === (db as unknown as StageManagementDb)) return withOrganization(user.organizationId, (tx) => upsertPipelineStage(user, input, tx as unknown as StageManagementDb));
  assertCanWriteOpportunities(user);

  if (user.role !== "ADMIN") {
    throw new Error("Only Admin can manage pipeline stages.");
  }

  return database.pipelineStage.upsert({
    where: { organizationId_name: { organizationId: user.organizationId, name: input.name } },
    update: {
      sortOrder: input.sortOrder,
      kind: input.kind,
      active: input.active
    },
    create: { ...input, organizationId: user.organizationId }
  });
}
