import type { PipelineStage, Prisma, User } from "@prisma/client";
import { db } from "@/server/db";
import { withOrganization } from "@/server/organizations/with-organization";
import { listOrganizationUserOptions } from "@/server/organizations/member-options";
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

const salesTargetInclude = {
  owner: { select: opportunityOwnerSelect },
  createdBy: { select: opportunityOwnerSelect }
} satisfies Prisma.SalesTargetInclude;

export type OpportunityOwner = Pick<User, "id" | "name" | "email" | "role">;
export type OpportunityListRecord = Prisma.OpportunityGetPayload<{ include: typeof opportunityListInclude }>;
export type OpportunityDetailRecord = Prisma.OpportunityGetPayload<{ include: typeof opportunityDetailInclude }>;
export type PipelineStageRecord = Pick<PipelineStage, "id" | "name" | "sortOrder" | "kind" | "active">;
export type SalesTargetRecord = Prisma.SalesTargetGetPayload<{ include: typeof salesTargetInclude }>;

type QueryDb = {
  opportunity: {
    findMany: (args: Prisma.OpportunityFindManyArgs) => Promise<OpportunityListRecord[]>;
    findFirst?: (args: Prisma.OpportunityFindFirstArgs) => Promise<OpportunityDetailRecord | null>;
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
    findMany: (args: Prisma.SalesTargetFindManyArgs) => Promise<SalesTargetRecord[]>;
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

function buildOpportunityWhere(organizationId: string, filters: OpportunityFilters): Prisma.OpportunityWhereInput {
  const where: Prisma.OpportunityWhereInput = { organizationId };

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
): Promise<OpportunityListRecord[]> {
  if (database === (db as unknown as QueryDb)) return withOrganization(user.organizationId, (tx) => listOpportunities(user, filters, tx as unknown as QueryDb));
  assertCanViewOpportunities(user);

  return database.opportunity.findMany({
    where: buildOpportunityWhere(user.organizationId, filters),
    orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
    include: opportunityListInclude
  });
}

export async function listPipelineBoard(
  user: OpportunityUser,
  filters: OpportunityFilters,
  database: QueryDb = db as unknown as QueryDb
): Promise<{ stages: PipelineStageRecord[]; recordsByStage: Record<string, OpportunityListRecord[]> }> {
  if (database === (db as unknown as QueryDb)) return withOrganization(user.organizationId, (tx) => listPipelineBoard(user, filters, tx as unknown as QueryDb));
  assertCanViewOpportunities(user);
  const where = buildOpportunityWhere(user.organizationId, filters);

  const [stages, opportunities] = await Promise.all([
    database.pipelineStage.findMany({
      where: { organizationId: user.organizationId, active: true },
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

export async function getOpportunityDetail(user: OpportunityUser, opportunityId: string, database: QueryDb = db as unknown as QueryDb): Promise<OpportunityDetailRecord | null> {
  if (database === (db as unknown as QueryDb)) return withOrganization(user.organizationId, (tx) => getOpportunityDetail(user, opportunityId, tx as unknown as QueryDb));
  assertCanViewOpportunities(user);

  return database.opportunity.findFirst!({
    where: { id: opportunityId, organizationId: user.organizationId },
    include: opportunityDetailInclude
  });
}

export async function listOpportunityFormOptions(user: OpportunityUser, database: QueryDb = db as unknown as QueryDb, preloadedOwners?: OpportunityOwner[]): Promise<{
  leads: Array<{ id: string; name: string; state: string }>;
  branches: Array<{ id: string; name: string; leadCustomerId: string }>;
  stages: PipelineStageRecord[];
  owners: OpportunityOwner[];
}> {
  if (database === (db as unknown as QueryDb)) {
    const owners = await listOrganizationUserOptions(user.organizationId, ["ADMIN", "SALES"]);
    return withOrganization(user.organizationId, (tx) => listOpportunityFormOptions(user, tx as unknown as QueryDb, owners));
  }
  const [leads, branches, stages, owners] = await Promise.all([
    database.leadCustomer!.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, state: true }
    }),
    database.branch!.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, leadCustomerId: true }
    }),
    database.pipelineStage.findMany({
      where: { organizationId: user.organizationId, active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, sortOrder: true, kind: true, active: true }
    }),
    preloadedOwners ? Promise.resolve(preloadedOwners) : database.user!.findMany({
      where: { active: true, role: { in: ["ADMIN", "SALES"] }, memberships: { some: { organizationId: user.organizationId, status: "ACTIVE" } } },
      orderBy: { name: "asc" },
      select: opportunityOwnerSelect
    })
  ]);

  return { leads, branches, stages, owners };
}

export async function listSalesTargets(user: OpportunityUser, database: QueryDb = db as unknown as QueryDb): Promise<SalesTargetRecord[]> {
  if (database === (db as unknown as QueryDb)) return withOrganization(user.organizationId, (tx) => listSalesTargets(user, tx as unknown as QueryDb));
  assertCanViewOpportunities(user);

  return database.salesTarget!.findMany({
    where: { organizationId: user.organizationId },
    orderBy: [{ financialYear: "desc" }, { quarter: "asc" }],
    include: salesTargetInclude
  });
}
