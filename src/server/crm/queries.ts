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
export type CustomerTimelineKind =
  | "activity"
  | "follow_up"
  | "task"
  | "text_note"
  | "voice_note"
  | "opportunity"
  | "proposal"
  | "order"
  | "production"
  | "invoice"
  | "payment"
  | "cost";

export type CustomerTimelineItem = {
  id: string;
  kind: CustomerTimelineKind;
  title: string;
  detail?: string;
  occurredAt: Date;
  actor?: string;
  href?: string;
  amount?: { currency: string; minorUnits: number };
};

type QueryDb = {
  leadCustomer: {
    findMany: (args: Prisma.LeadCustomerFindManyArgs) => Promise<LeadCustomerListRecord[]>;
    count?: (args?: Prisma.LeadCustomerCountArgs) => Promise<number>;
  };
  user: {
    findMany: (args: Prisma.UserFindManyArgs) => Promise<CrmOwner[]>;
  };
};

type CustomerTimelineDb = {
  activity: {
    findMany: (args: Prisma.ActivityFindManyArgs) => Promise<
      Array<{
        id: string;
        subject: string;
        type: string;
        status: string;
        occurredAt: Date | null;
        dueAt: Date | null;
        createdAt: Date;
        owner: { id: string; name: string };
      }>
    >;
  };
  salesTextNote: {
    findMany: (args: Prisma.SalesTextNoteFindManyArgs) => Promise<
      Array<{ id: string; body: string; createdAt: Date; owner: { id: string; name: string } }>
    >;
  };
  salesTask: {
    findMany: (args: Prisma.SalesTaskFindManyArgs) => Promise<
      Array<{
        id: string;
        title: string;
        type: string;
        priority: string;
        status: string;
        dueAt: Date | null;
        updatedAt: Date;
        owner: { id: string; name: string };
      }>
    >;
  };
  salesVoiceNote: {
    findMany: (args: Prisma.SalesVoiceNoteFindManyArgs) => Promise<
      Array<{
        id: string;
        summary: string | null;
        transcript: string | null;
        status: string;
        createdAt: Date;
        owner: { id: string; name: string };
      }>
    >;
  };
  opportunity: {
    findMany: (args: Prisma.OpportunityFindManyArgs) => Promise<
      Array<{
        id: string;
        title: string;
        nextFollowUpAt: Date | null;
        updatedAt: Date;
        stage: { name: string };
        owner: { id: string; name: string };
      }>
    >;
  };
  proposal: {
    findMany: (args: Prisma.ProposalFindManyArgs) => Promise<
      Array<{ id: string; title: string; status: string; totalPaisa: number; currency: string; updatedAt: Date }>
    >;
  };
  order: {
    findMany: (args: Prisma.OrderFindManyArgs) => Promise<
      Array<{
        id: string;
        orderNumber: string;
        status: string;
        totalPaisa: number;
        currency: string;
        bookedAt: Date;
        productionWorkItems?: Array<{ id: string; status: string; title: string; updatedAt?: Date }>;
        lineItems?: Array<{ productionWorkItems: Array<{ id: string; status: string; title: string; updatedAt?: Date }> }>;
        invoices: Array<{ id: string; invoiceNumber: string; totalPaisa: number; status: string; invoiceDate: Date }>;
        payments: Array<{ id: string; amountPaisa: number; paymentDate: Date }>;
        costComponents: Array<{ id: string; description: string; amountPaisa: number; status: string; createdAt: Date }>;
      }>
    >;
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

function timelineItem(item: CustomerTimelineItem): CustomerTimelineItem {
  return item;
}

const timelineKindRank: Record<CustomerTimelineKind, number> = {
  cost: 0,
  payment: 1,
  invoice: 2,
  production: 3,
  order: 4,
  proposal: 5,
  opportunity: 6,
  follow_up: 7,
  task: 8,
  voice_note: 9,
  text_note: 10,
  activity: 11
};

export async function getCustomer360Timeline(
  user: CrmUser,
  leadCustomerId: string,
  database: CustomerTimelineDb = db as unknown as CustomerTimelineDb
): Promise<CustomerTimelineItem[]> {
  assertCanViewCrmRecords(user);

  const [activities, salesTasks, textNotes, voiceNotes, opportunities, proposals, orders] = await Promise.all([
    database.activity.findMany({
      where: { leadCustomerId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        subject: true,
        type: true,
        status: true,
        occurredAt: true,
        dueAt: true,
        createdAt: true,
        owner: { select: { id: true, name: true } }
      }
    }),
    database.salesTask.findMany({
      where: { leadCustomerId },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
      take: 50,
      select: {
        id: true,
        title: true,
        type: true,
        priority: true,
        status: true,
        dueAt: true,
        updatedAt: true,
        owner: { select: { id: true, name: true } }
      }
    }),
    database.salesTextNote.findMany({
      where: { leadCustomerId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, body: true, createdAt: true, owner: { select: { id: true, name: true } } }
    }),
    database.salesVoiceNote.findMany({
      where: { leadCustomerId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        summary: true,
        transcript: true,
        status: true,
        createdAt: true,
        owner: { select: { id: true, name: true } }
      }
    }),
    database.opportunity.findMany({
      where: { leadCustomerId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        nextFollowUpAt: true,
        updatedAt: true,
        stage: { select: { name: true } },
        owner: { select: { id: true, name: true } }
      }
    }),
    database.proposal.findMany({
      where: { opportunity: { leadCustomerId } },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, title: true, status: true, totalPaisa: true, currency: true, updatedAt: true }
    }),
    database.order.findMany({
      where: { leadCustomerId },
      orderBy: { bookedAt: "desc" },
      take: 50,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalPaisa: true,
        currency: true,
        bookedAt: true,
        lineItems: {
          select: {
            productionWorkItems: { select: { id: true, status: true, title: true, updatedAt: true } }
          }
        },
        invoices: { select: { id: true, invoiceNumber: true, totalPaisa: true, status: true, invoiceDate: true } },
        payments: { select: { id: true, amountPaisa: true, paymentDate: true } },
        costComponents: { select: { id: true, description: true, amountPaisa: true, status: true, createdAt: true } }
      }
    })
  ]);

  const items: CustomerTimelineItem[] = [
    ...activities
      .filter((activity) => activity.status === "OPEN" && activity.dueAt)
      .map((activity) =>
        timelineItem({
          id: activity.id,
          kind: "follow_up",
          title: `Follow up: ${activity.subject}`,
          detail: `${activity.type} | ${activity.status}`,
          occurredAt: activity.dueAt ?? activity.createdAt,
          actor: activity.owner.name,
          href: `/leads/${leadCustomerId}`
        })
      ),
    ...activities.map((activity) =>
      timelineItem({
        id: activity.id,
        kind: "activity",
        title: activity.subject,
        detail: `${activity.type} | ${activity.status}`,
        occurredAt: activity.occurredAt ?? activity.dueAt ?? activity.createdAt,
        actor: activity.owner.name
      })
    ),
    ...salesTasks.map((task) =>
      timelineItem({
        id: task.id,
        kind: "task",
        title: task.title,
        detail: `${task.type} | ${task.priority} | ${task.status}`,
        occurredAt: task.dueAt ?? task.updatedAt,
        actor: task.owner.name,
        href: "/my-day"
      })
    ),
    ...textNotes.map((note) =>
      timelineItem({
        id: note.id,
        kind: "text_note",
        title: "Typed note",
        detail: note.body,
        occurredAt: note.createdAt,
        actor: note.owner.name
      })
    ),
    ...voiceNotes.map((note) =>
      timelineItem({
        id: note.id,
        kind: "voice_note",
        title: note.summary ?? "Voice note",
        detail: note.transcript ?? note.status,
        occurredAt: note.createdAt,
        actor: note.owner.name
      })
    ),
    ...opportunities.map((opportunity) =>
      timelineItem({
        id: opportunity.id,
        kind: "opportunity",
        title: opportunity.title,
        detail: `Stage: ${opportunity.stage.name}`,
        occurredAt: opportunity.updatedAt,
        actor: opportunity.owner.name,
        href: `/opportunities/${opportunity.id}`
      })
    ),
    ...opportunities
      .filter((opportunity) => opportunity.nextFollowUpAt)
      .map((opportunity) =>
        timelineItem({
          id: opportunity.id,
          kind: "follow_up",
          title: `Follow up: ${opportunity.title}`,
          detail: `Opportunity follow-up | Stage: ${opportunity.stage.name}`,
          occurredAt: opportunity.nextFollowUpAt ?? opportunity.updatedAt,
          actor: opportunity.owner.name,
          href: `/opportunities/${opportunity.id}`
        })
      ),
    ...proposals.map((proposal) =>
      timelineItem({
        id: proposal.id,
        kind: "proposal",
        title: `Proposal ${proposal.status}: ${proposal.title}`,
        occurredAt: proposal.updatedAt,
        amount: { currency: proposal.currency, minorUnits: proposal.totalPaisa }
      })
    )
  ];

  for (const order of orders) {
    items.push(
      timelineItem({
        id: order.id,
        kind: "order",
        title: `Order ${order.status}: ${order.orderNumber}`,
        occurredAt: order.bookedAt,
        href: `/orders/${order.id}`,
        amount: { currency: order.currency, minorUnits: order.totalPaisa }
      })
    );

    const workItems = order.lineItems?.flatMap((line) => line.productionWorkItems) ?? order.productionWorkItems ?? [];
    for (const workItem of workItems) {
      items.push(
        timelineItem({
          id: workItem.id,
          kind: "production",
          title: `Production ${workItem.status}: ${workItem.title}`,
          occurredAt: workItem.updatedAt ?? order.bookedAt,
          href: `/production`
        })
      );
    }

    for (const invoice of order.invoices) {
      items.push(
        timelineItem({
          id: invoice.id,
          kind: "invoice",
          title: `Invoice ${invoice.status}: ${invoice.invoiceNumber}`,
          occurredAt: invoice.invoiceDate,
          href: `/orders/${order.id}`,
          amount: { currency: order.currency, minorUnits: invoice.totalPaisa }
        })
      );
    }

    for (const payment of order.payments) {
      items.push(
        timelineItem({
          id: payment.id,
          kind: "payment",
          title: "Payment received",
          occurredAt: payment.paymentDate,
          href: `/orders/${order.id}`,
          amount: { currency: order.currency, minorUnits: payment.amountPaisa }
        })
      );
    }

    for (const cost of order.costComponents) {
      items.push(
        timelineItem({
          id: cost.id,
          kind: "cost",
          title: `Cost ${cost.status.toLowerCase()}: ${cost.description}`,
          occurredAt: cost.createdAt,
          href: `/orders/${order.id}`,
          amount: { currency: order.currency, minorUnits: cost.amountPaisa }
        })
      );
    }
  }

  return items.sort((left, right) => {
    const dateDiff = right.occurredAt.getTime() - left.occurredAt.getTime();
    return dateDiff !== 0 ? dateDiff : timelineKindRank[left.kind] - timelineKindRank[right.kind];
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
