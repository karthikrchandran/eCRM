import type { Prisma, User } from "@prisma/client";
import { db } from "@/server/db";
import { assertCanViewCrmRecords, type CrmUser } from "./permissions";
import type { LeadFilters } from "./types";

const crmOwnerSelect = {
  id: true,
  name: true,
  email: true,
  role: true
} satisfies Prisma.UserSelect;

const leadListInclude = {
  owner: { select: crmOwnerSelect },
  branches: { orderBy: { name: "asc" }, take: 3 },
  contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }], take: 3 },
  activities: {
    where: { status: "OPEN", dueAt: { not: null } },
    orderBy: { dueAt: "asc" },
    take: 1
  },
  _count: { select: { branches: true, contacts: true, activities: true } }
} satisfies Prisma.LeadCustomerInclude;

const leadDetailInclude = {
  owner: { select: crmOwnerSelect },
  branches: { orderBy: { name: "asc" } },
  contacts: {
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    include: { branch: { select: { id: true, name: true, city: true } } }
  },
  activities: {
    orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    include: {
      owner: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } }
    }
  },
  ownershipHistory: {
    orderBy: { createdAt: "desc" },
    include: {
      fromOwner: { select: { id: true, name: true } },
      toOwner: { select: { id: true, name: true } },
      changedBy: { select: { id: true, name: true } }
    }
  }
} satisfies Prisma.LeadCustomerInclude;

export type CrmOwner = Pick<User, "id" | "name" | "email" | "role">;
export type LeadCustomerListRecord = Prisma.LeadCustomerGetPayload<{ include: typeof leadListInclude }>;
export type LeadCustomerDetail = Prisma.LeadCustomerGetPayload<{ include: typeof leadDetailInclude }>;

type QueryDb = {
  leadCustomer: {
    findMany: (args: Prisma.LeadCustomerFindManyArgs) => Promise<LeadCustomerListRecord[]>;
    count?: (args?: Prisma.LeadCustomerCountArgs) => Promise<number>;
  };
  user: {
    findMany: (args: Prisma.UserFindManyArgs) => Promise<CrmOwner[]>;
  };
};

function buildLeadWhere(filters: LeadFilters): Prisma.LeadCustomerWhereInput {
  const where: Prisma.LeadCustomerWhereInput = {};

  if (filters.ownerId) {
    where.ownerId = filters.ownerId;
  }

  if (filters.state) {
    where.state = filters.state;
  }

  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { industry: { contains: filters.q, mode: "insensitive" } },
      { source: { contains: filters.q, mode: "insensitive" } },
      { contacts: { some: { name: { contains: filters.q, mode: "insensitive" } } } },
      { branches: { some: { name: { contains: filters.q, mode: "insensitive" } } } }
    ];
  }

  if (filters.followUp) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    where.activities = {
      some: {
        status: "OPEN",
        dueAt:
          filters.followUp === "overdue"
            ? { lt: startOfToday }
            : filters.followUp === "today"
              ? { gte: startOfToday, lt: startOfTomorrow }
              : { gte: startOfTomorrow }
      }
    };
  }

  return where;
}

export async function listLeadCustomers(
  user: CrmUser,
  filters: LeadFilters,
  database: QueryDb = db as unknown as QueryDb
) {
  assertCanViewCrmRecords(user);
  const where = buildLeadWhere(filters);

  const [records, owners] = await Promise.all([
    database.leadCustomer.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      include: leadListInclude
    }),
    database.user.findMany({
      where: { active: true, role: { in: ["ADMIN", "SALES"] } },
      orderBy: { name: "asc" },
      select: crmOwnerSelect
    })
  ]);

  return { records, owners };
}

export async function getLeadCustomerDetail(user: CrmUser, leadCustomerId: string) {
  assertCanViewCrmRecords(user);

  return db.leadCustomer.findUnique({
    where: { id: leadCustomerId },
    include: leadDetailInclude
  });
}

export async function listCrmOwners(): Promise<CrmOwner[]> {
  return db.user.findMany({
    where: { active: true, role: { in: ["ADMIN", "SALES"] } },
    orderBy: { name: "asc" },
    select: crmOwnerSelect
  });
}

export async function listBranchOptions(user: CrmUser, leadCustomerId: string) {
  assertCanViewCrmRecords(user);

  return db.branch.findMany({
    where: { leadCustomerId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, city: true, region: true }
  });
}

export async function getDashboardFollowUpCounts(user: CrmUser) {
  assertCanViewCrmRecords(user);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const [overdue, today, upcoming] = await Promise.all([
    db.activity.count({ where: { status: "OPEN", dueAt: { lt: startOfToday } } }),
    db.activity.count({ where: { status: "OPEN", dueAt: { gte: startOfToday, lt: startOfTomorrow } } }),
    db.activity.count({ where: { status: "OPEN", dueAt: { gte: startOfTomorrow } } })
  ]);

  return { overdue, today, upcoming };
}
