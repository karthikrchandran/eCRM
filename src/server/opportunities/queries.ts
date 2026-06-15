import type { PipelineStage, Prisma, User } from "@prisma/client";
import { db } from "@/server/db";
import { assertCanViewOpportunities, type OpportunityUser } from "./permissions";
import type { OpportunityFilters } from "./types";

const opportunityOwnerSelect = {
  id: true,
  name: true,
  email: true,
  role: true
} satisfies Prisma.UserSelect;

const opportunityListInclude = {
  leadCustomer: { select: { id: true, name: true, state: true } },
  branch: { select: { id: true, name: true, city: true, region: true } },
  stage: { select: { id: true, name: true, sortOrder: true, kind: true } },
  owner: { select: opportunityOwnerSelect },
  splits: {
    include: {
      user: { select: opportunityOwnerSelect }
    },
    orderBy: { percent: "desc" }
  }
} satisfies Prisma.OpportunityInclude;

const opportunityDetailInclude = {
  ...opportunityListInclude,
  createdBy: { select: opportunityOwnerSelect },
  updatedBy: { select: opportunityOwnerSelect }
} satisfies Prisma.OpportunityInclude;

export type OpportunityOwner = Pick<User, "id" | "name" | "email" | "role">;
export type OpportunityListRecord = Prisma.OpportunityGetPayload<{ include: typeof opportunityListInclude }>;
export type OpportunityDetailRecord = Prisma.OpportunityGetPayload<{ include: typeof opportunityDetailInclude }>;
export type PipelineStageRecord = Pick<PipelineStage, "id" | "name" | "sortOrder" | "kind" | "active">;

type QueryDb = {
  opportunity: {
    findMany: (args: Prisma.OpportunityFindManyArgs) => Promise<OpportunityListRecord[]>;
    findUnique?: (args: Prisma.OpportunityFindUniqueArgs) => Promise<OpportunityDetailRecord | null>;
  };
  pipelineStage: {
    findMany: (args: Prisma.PipelineStageFindManyArgs) => Promise<PipelineStageRecord[]>;
  };
  user?: {
    findMany: (args: Prisma.UserFindManyArgs) => Promise<OpportunityOwner[]>;
  };
  leadCustomer?: {
    findMany: (args: Prisma.LeadCustomerFindManyArgs) => Promise<Array<{ id: string; name: string; state: string }>>;
  };
  branch?: {
    findMany: (args: Prisma.BranchFindManyArgs) => Promise<Array<{ id: string; name: string; leadCustomerId: string }>>;
  };
  salesTarget?: {
    findMany: (args: Prisma.SalesTargetFindManyArgs) => Promise<unknown[]>;
  };
};

function buildFollowUpFilter(followUp: NonNullable<OpportunityFilters["followUp"]>) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  if (followUp === "overdue") {
    return { lt: startOfToday };
  }

  if (followUp === "today") {
    return { gte: startOfToday, lt: startOfTomorrow };
  }

  return { gte: startOfTomorrow };
}

function buildOpportunityWhere(filters: OpportunityFilters): Prisma.OpportunityWhereInput {
  const where: Prisma.OpportunityWhereInput = {};

  if (filters.ownerId) {
    where.ownerId = filters.ownerId;
  }

  if (filters.stageId) {
    where.stageId = filters.stageId;
  }

  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { productInterest: { contains: filters.q, mode: "insensitive" } },
      { notes: { contains: filters.q, mode: "insensitive" } },
      { leadCustomer: { name: { contains: filters.q, mode: "insensitive" } } },
      { branch: { name: { contains: filters.q, mode: "insensitive" } } }
    ];
  }

  if (filters.followUp) {
    where.nextFollowUpAt = buildFollowUpFilter(filters.followUp);
  }

  return where;
}

export async function listOpportunities(
  user: OpportunityUser,
  filters: OpportunityFilters,
  database: QueryDb = db as unknown as QueryDb
) {
  assertCanViewOpportunities(user);

  return database.opportunity.findMany({
    where: buildOpportunityWhere(filters),
    orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
    include: opportunityListInclude
  });
}

export async function listPipelineBoard(
  user: OpportunityUser,
  filters: OpportunityFilters,
  database: QueryDb = db as unknown as QueryDb
) {
  assertCanViewOpportunities(user);
  const where = buildOpportunityWhere(filters);

  const [stages, opportunities] = await Promise.all([
    database.pipelineStage.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, sortOrder: true, kind: true, active: true }
    }),
    database.opportunity.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
      include: opportunityListInclude
    })
  ]);

  const recordsByStage: Record<string, OpportunityListRecord[]> = Object.fromEntries(stages.map((stage) => [stage.id, []]));

  for (const opportunity of opportunities) {
    recordsByStage[opportunity.stageId] = recordsByStage[opportunity.stageId] ?? [];
    recordsByStage[opportunity.stageId].push(opportunity);
  }

  return { stages, recordsByStage };
}

export async function getOpportunityDetail(user: OpportunityUser, opportunityId: string) {
  assertCanViewOpportunities(user);

  return db.opportunity.findUnique({
    where: { id: opportunityId },
    include: opportunityDetailInclude
  });
}

export async function listOpportunityFormOptions() {
  const [leads, branches, stages, owners] = await Promise.all([
    db.leadCustomer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, state: true }
    }),
    db.branch.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, leadCustomerId: true }
    }),
    db.pipelineStage.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, sortOrder: true, kind: true, active: true }
    }),
    db.user.findMany({
      where: { active: true, role: { in: ["ADMIN", "SALES"] } },
      orderBy: { name: "asc" },
      select: opportunityOwnerSelect
    })
  ]);

  return { leads, branches, stages, owners };
}

export async function listSalesTargets(user: OpportunityUser) {
  assertCanViewOpportunities(user);

  return db.salesTarget.findMany({
    orderBy: [{ financialYear: "desc" }, { quarter: "asc" }],
    include: {
      owner: { select: opportunityOwnerSelect },
      createdBy: { select: opportunityOwnerSelect }
    }
  });
}
