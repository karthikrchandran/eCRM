import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { assertCanWriteOpportunities, type OpportunityUser } from "./permissions";
import type { OpportunityInput, OpportunitySplitInput, PipelineStageInput, SalesTargetInput } from "./types";

type IdResult = { id: string };

type OwnerDb = {
  user: {
    findFirst: (args: Prisma.UserFindFirstArgs) => Promise<IdResult | null>;
  };
};

type LeadDb = {
  leadCustomer: {
    findUnique: (args: Prisma.LeadCustomerFindUniqueArgs) => Promise<IdResult | null>;
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
    $transaction: (callback: (tx: unknown) => Promise<IdResult>) => Promise<IdResult>;
  };

type UpdateOpportunityDb = OwnerDb &
  LeadDb &
  BranchDb &
  StageDb & {
    opportunity: {
      findUnique: (args: Prisma.OpportunityFindUniqueArgs) => Promise<IdResult | null>;
      update: (args: Prisma.OpportunityUpdateArgs) => Promise<IdResult>;
    };
    opportunityOwnerSplit: OpportunityTransactionDb["opportunityOwnerSplit"];
    $transaction: (callback: (tx: unknown) => Promise<IdResult>) => Promise<IdResult>;
  };

type MoveOpportunityDb = StageDb & {
  opportunity: {
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

async function assertActiveOwner(database: OwnerDb, ownerId: string) {
  const owner = await database.user.findFirst({
    where: { id: ownerId, active: true, role: { in: ["ADMIN", "SALES"] } },
    select: { id: true }
  });

  if (!owner) {
    throw new Error("Choose an active Admin or Sales owner.");
  }
}

async function assertLeadExists(database: LeadDb, leadCustomerId: string) {
  const lead = await database.leadCustomer.findUnique({
    where: { id: leadCustomerId },
    select: { id: true }
  });

  if (!lead) {
    throw new Error("Lead or customer was not found.");
  }
}

async function assertBranchBelongsToLead(database: BranchDb, leadCustomerId: string, branchId: string) {
  const branch = await database.branch?.findFirst({
    where: { id: branchId, leadCustomerId },
    select: { id: true }
  });

  if (!branch) {
    throw new Error("Choose a branch that belongs to this lead or customer.");
  }
}

async function assertActiveStage(database: StageDb, stageId: string) {
  const stage = await database.pipelineStage.findFirst({
    where: { id: stageId, active: true },
    select: { id: true }
  });

  if (!stage) {
    throw new Error("Choose an active pipeline stage.");
  }
}

async function assertValidSplits(database: OwnerDb, splits: OpportunitySplitInput[]) {
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

    await assertActiveOwner(database, split.userId);
  }
}

function opportunityData(user: OpportunityUser, input: OpportunityInput) {
  return {
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
) {
  assertCanWriteOpportunities(user);
  await assertLeadExists(database, input.leadCustomerId);
  await assertActiveOwner(database, input.ownerId);
  await assertActiveStage(database, input.stageId);
  await assertValidSplits(database, splits);

  if (input.branchId) {
    await assertBranchBelongsToLead(database, input.leadCustomerId, input.branchId);
  }

  return database.$transaction(async (tx) => {
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
          opportunityId: opportunity.id,
          userId: split.userId,
          percent: split.percent
        }))
      });
    }

    return opportunity;
  });
}

export async function updateOpportunity(
  user: OpportunityUser,
  opportunityId: string,
  input: OpportunityInput,
  splits: OpportunitySplitInput[] = [],
  database: UpdateOpportunityDb = db as unknown as UpdateOpportunityDb
) {
  assertCanWriteOpportunities(user);
  const existing = await database.opportunity.findUnique({
    where: { id: opportunityId },
    select: { id: true }
  });

  if (!existing) {
    throw new Error("Opportunity was not found.");
  }

  await assertLeadExists(database, input.leadCustomerId);
  await assertActiveOwner(database, input.ownerId);
  await assertActiveStage(database, input.stageId);
  await assertValidSplits(database, splits);

  if (input.branchId) {
    await assertBranchBelongsToLead(database, input.leadCustomerId, input.branchId);
  }

  return database.$transaction(async (tx) => {
    const transaction = tx as UpdateOpportunityTransactionDb;
    const opportunity = await transaction.opportunity.update({
      where: { id: opportunityId },
      data: opportunityData(user, input)
    });

    await transaction.opportunityOwnerSplit.deleteMany({ where: { opportunityId } });

    if (splits.length > 0) {
      await transaction.opportunityOwnerSplit.createMany({
        data: splits.map((split) => ({
          opportunityId,
          userId: split.userId,
          percent: split.percent
        }))
      });
    }

    return opportunity;
  });
}

export async function moveOpportunityStage(
  user: OpportunityUser,
  opportunityId: string,
  stageId: string,
  database: MoveOpportunityDb = db as unknown as MoveOpportunityDb
) {
  assertCanWriteOpportunities(user);
  await assertActiveStage(database, stageId);

  return database.opportunity.update({
    where: { id: opportunityId },
    data: { stageId, updatedById: user.id }
  });
}

export async function upsertSalesTarget(
  user: OpportunityUser,
  input: SalesTargetInput,
  database: TargetDb = db as unknown as TargetDb
) {
  assertCanWriteOpportunities(user);
  await assertActiveOwner(database, input.ownerId);

  return database.salesTarget.upsert({
    where: {
      ownerId_financialYear_quarter: {
        ownerId: input.ownerId,
        financialYear: input.financialYear,
        quarter: input.quarter
      }
    },
    update: { targetValueInr: input.targetValueInr },
    create: {
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
) {
  assertCanWriteOpportunities(user);

  if (user.role !== "ADMIN") {
    throw new Error("Only Admin can manage pipeline stages.");
  }

  return database.pipelineStage.upsert({
    where: { name: input.name },
    update: {
      sortOrder: input.sortOrder,
      kind: input.kind,
      active: input.active
    },
    create: input
  });
}
