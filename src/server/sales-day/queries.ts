import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { assertCanUseSalesWorkspace, type SalesDayUser } from "./permissions";
import type { MyDayInsightsViewModel, MyDayLinkedRecord, MyDayTaskRecord, MyDayViewModel } from "./types";

const priorityRank = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3
} as const;

const taskInclude = {
  leadCustomer: { select: { id: true, name: true } },
  opportunity: { select: { id: true, title: true } },
  proposal: { select: { id: true, title: true } },
  order: { select: { id: true, orderNumber: true } },
  voiceNotes: {
    orderBy: { createdAt: "desc" },
    include: {
      actions: {
        where: { status: "DRAFT" },
        orderBy: { createdAt: "asc" }
      }
    }
  }
} satisfies Prisma.SalesTaskInclude;

type TaskRecord = Prisma.SalesTaskGetPayload<{ include: typeof taskInclude }>;
type VoiceNoteRecord = NonNullable<TaskRecord["voiceNotes"][number]>;
type InsightVoiceNoteRecord = {
  id: string;
  summary: string | null;
  transcript: string | null;
  createdAt: Date;
  leadCustomer: { id: string; name: string } | null;
};

type LookupRecord = { id: string; label?: string; name?: string; title?: string; orderNumber?: string };

type QueryDb = {
  salesTask: {
    findMany: (args: Prisma.SalesTaskFindManyArgs) => Promise<TaskRecord[]>;
  };
  salesVoiceNote?: {
    findMany: (args: Prisma.SalesVoiceNoteFindManyArgs) => Promise<Array<VoiceNoteRecord | InsightVoiceNoteRecord>>;
  };
  salesVoiceNoteAction?: {
    findMany: (args: Prisma.SalesVoiceNoteActionFindManyArgs) => Promise<
      Array<{
        id: string;
        title: string;
        voiceNote: { leadCustomer: { id: string; name: string } | null };
      }>
    >;
  };
  leadCustomer?: {
    findMany: (args: Prisma.LeadCustomerFindManyArgs) => Promise<LookupRecord[]>;
  };
  opportunity?: {
    findMany: (args: Prisma.OpportunityFindManyArgs) => Promise<
      Array<LookupRecord & { nextFollowUpAt?: Date | null; leadCustomer?: { id: string; name: string } | null }>
    >;
  };
  proposal?: {
    findMany: (args: Prisma.ProposalFindManyArgs) => Promise<LookupRecord[]>;
  };
  order?: {
    findMany: (args: Prisma.OrderFindManyArgs) => Promise<LookupRecord[]>;
  };
};

export type MyDayLookups = {
  leadCustomers: MyDayLinkedRecord[];
  opportunities: MyDayLinkedRecord[];
  proposals: MyDayLinkedRecord[];
  orders: MyDayLinkedRecord[];
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function linkedRecord(record?: { id: string; name?: string; title?: string; orderNumber?: string } | null) {
  if (!record) return null;
  return {
    id: record.id,
    label: record.name ?? record.title ?? record.orderNumber ?? record.id
  };
}

function audioUrlForVoiceNote(id: string) {
  return `/my-day/voice-notes/${id}/audio`;
}

function mapVoiceNote(note: VoiceNoteRecord) {
  return {
    id: note.id,
    taskId: note.taskId,
    status: note.status,
    audioUrl: audioUrlForVoiceNote(note.id),
    transcript: note.transcript,
    summary: note.summary,
    customerAsk: note.customerAsk,
    nextStep: note.nextStep,
    processingError: note.processingError,
    createdAt: note.createdAt,
    actions: note.actions.map((action) => ({
      id: action.id,
      title: action.title,
      description: action.description,
      type: action.type,
      suggestedDueAt: action.suggestedDueAt,
      status: action.status,
      confidenceLabel: action.confidenceLabel
    }))
  };
}

function mapTask(record: TaskRecord): MyDayTaskRecord {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    type: record.type,
    priority: record.priority,
    status: record.status,
    source: record.source,
    dueAt: record.dueAt,
    completedAt: record.completedAt,
    leadCustomer: linkedRecord(record.leadCustomer),
    opportunity: linkedRecord(record.opportunity),
    proposal: linkedRecord(record.proposal),
    order: linkedRecord(record.order),
    voiceNotes: record.voiceNotes.map(mapVoiceNote)
  };
}

function sortTasks(left: MyDayTaskRecord, right: MyDayTaskRecord) {
  const priorityDiff = priorityRank[left.priority] - priorityRank[right.priority];
  if (priorityDiff !== 0) return priorityDiff;

  const leftDue = left.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const rightDue = right.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  if (leftDue !== rightDue) return leftDue - rightDue;

  return left.title.localeCompare(right.title);
}

function mapLookup(record: LookupRecord): MyDayLinkedRecord {
  return {
    id: record.id,
    label: record.label ?? record.name ?? record.title ?? record.orderNumber ?? record.id
  };
}

export async function loadMyDay(
  user: SalesDayUser,
  date: Date,
  database: QueryDb = db as unknown as QueryDb
): Promise<MyDayViewModel> {
  assertCanUseSalesWorkspace(user);
  const dayStart = startOfDay(date);
  const dayEnd = addDays(dayStart, 1);

  const [records, standaloneVoiceNotes] = await Promise.all([
    database.salesTask.findMany({
      where: {
        ownerId: user.id,
        OR: [
          { dueAt: { gte: dayStart, lt: dayEnd } },
          { status: "OPEN", dueAt: { lt: dayStart } },
          { dueAt: null, createdAt: { gte: dayStart, lt: dayEnd } }
        ]
      },
      include: taskInclude,
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }]
    }),
    database.salesVoiceNote?.findMany({
      where: {
        ownerId: user.id,
        taskId: null,
        createdAt: { gte: dayStart, lt: dayEnd }
      },
      include: {
        actions: {
          where: { status: "DRAFT" },
          orderBy: { createdAt: "asc" }
        }
      },
      orderBy: { createdAt: "desc" }
    }) ?? Promise.resolve([])
  ]);

  const view: MyDayViewModel = {
    date: dayStart,
    openTasks: [],
    overdueTasks: [],
    completedTasks: [],
    cancelledTasks: [],
    voiceNotes: (standaloneVoiceNotes as VoiceNoteRecord[]).map(mapVoiceNote)
  };

  for (const task of records.map(mapTask)) {
    if (task.status === "COMPLETED") {
      view.completedTasks.push(task);
    } else if (task.status === "CANCELLED") {
      view.cancelledTasks.push(task);
    } else if (task.status === "OPEN" && task.dueAt && task.dueAt < dayStart) {
      view.overdueTasks.push(task);
    } else {
      view.openTasks.push(task);
    }
  }

  view.openTasks.sort(sortTasks);
  view.overdueTasks.sort(sortTasks);
  view.completedTasks.sort(sortTasks);
  view.cancelledTasks.sort(sortTasks);

  return view;
}

export async function loadMyDayLookups(
  user: SalesDayUser,
  database: QueryDb = db as unknown as QueryDb
): Promise<MyDayLookups> {
  assertCanUseSalesWorkspace(user);

  const [leadCustomers, opportunities, proposals, orders] = await Promise.all([
    database.leadCustomer?.findMany({
      where: { state: { in: ["LEAD", "CUSTOMER"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }) ?? Promise.resolve([]),
    database.opportunity?.findMany({
      where: { ownerId: user.id },
      orderBy: { title: "asc" },
      select: { id: true, title: true }
    }) ?? Promise.resolve([]),
    database.proposal?.findMany({
      where: { status: { in: ["SENT", "ACCEPTED"] } },
      orderBy: { title: "asc" },
      select: { id: true, title: true }
    }) ?? Promise.resolve([]),
    database.order?.findMany({
      where: { status: { in: ["BOOKED", "IN_PRODUCTION"] }, ownerId: user.id },
      orderBy: { orderNumber: "asc" },
      select: { id: true, orderNumber: true }
    }) ?? Promise.resolve([])
  ]);

  return {
    leadCustomers: leadCustomers.map(mapLookup),
    opportunities: opportunities.map(mapLookup),
    proposals: proposals.map(mapLookup),
    orders: orders.map(mapLookup)
  };
}

export async function loadMyDayInsights(
  user: SalesDayUser,
  date: Date,
  database: QueryDb = db as unknown as QueryDb
): Promise<MyDayInsightsViewModel> {
  assertCanUseSalesWorkspace(user);
  const today = startOfDay(date);
  const tomorrow = addDays(today, 1);
  const weekAgo = addDays(today, -7);

  const [carryForwardRecords, voiceNotes, opportunities, draftActions] = await Promise.all([
    database.salesTask.findMany({
      where: {
        ownerId: user.id,
        status: "OPEN",
        OR: [{ dueAt: { lt: tomorrow } }, { dueAt: null }]
      },
      include: taskInclude,
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }]
    }),
    database.salesVoiceNote?.findMany({
      where: {
        ownerId: user.id,
        createdAt: { gte: weekAgo },
        OR: [{ summary: { not: null } }, { transcript: { not: null } }]
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        summary: true,
        transcript: true,
        createdAt: true,
        leadCustomer: { select: { id: true, name: true } }
      }
    }) ?? Promise.resolve([]),
    database.opportunity?.findMany({
      where: {
        ownerId: user.id,
        nextFollowUpAt: { lte: tomorrow }
      },
      orderBy: { nextFollowUpAt: "asc" },
      take: 5,
      select: {
        id: true,
        title: true,
        nextFollowUpAt: true,
        leadCustomer: { select: { id: true, name: true } }
      }
    }) ?? Promise.resolve([]),
    database.salesVoiceNoteAction?.findMany({
      where: { status: "DRAFT", voiceNote: { ownerId: user.id } },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: {
        id: true,
        title: true,
        voiceNote: { select: { leadCustomer: { select: { id: true, name: true } } } }
      }
    }) ?? Promise.resolve([])
  ]);

  const carryForwardTasks = carryForwardRecords.map(mapTask).sort(sortTasks);

  return {
    carryForwardTasks,
    suggestedTomorrowTasks: carryForwardTasks.slice(0, 5).map((task) => ({
      id: task.id,
      title: task.title,
      detail: "Carry forward unfinished work into tomorrow",
      linkedRecord: task.leadCustomer
    })),
    voiceNoteSummaries: (voiceNotes as InsightVoiceNoteRecord[]).map((note) => ({
      id: note.id,
      title: note.summary ?? "Voice note transcript",
      detail: note.transcript?.slice(0, 160) ?? "Summary captured from voice note",
      linkedRecord: linkedRecord(note.leadCustomer)
    })),
    accountsNeedingAttention: [
      ...opportunities.map((opportunity) => ({
        id: opportunity.id,
        title: opportunity.title ?? opportunity.id,
        detail: opportunity.leadCustomer
          ? `Follow-up due for ${opportunity.leadCustomer.name}`
          : "Opportunity follow-up is due",
        linkedRecord: linkedRecord(opportunity.leadCustomer)
      })),
      ...draftActions.map((action) => ({
        id: action.id,
        title: action.title,
        detail: "Draft voice-note action is waiting for confirmation",
        linkedRecord: linkedRecord(action.voiceNote.leadCustomer)
      }))
    ]
  };
}
