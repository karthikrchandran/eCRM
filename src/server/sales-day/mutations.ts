import type { Prisma, SalesDayReviewItemStatus, SalesTaskType } from "@prisma/client";
import { tenantBoundary as db } from "@/server/organizations/tenant-boundary";
import { assertTenantMember } from "@/server/organizations/tenant-member-guard";
import { withOrganization } from "@/server/organizations/with-organization";
import {
  assertCanUseSalesWorkspace,
  assertOwnsSalesTextNote,
  assertOwnsSalesTask,
  assertOwnsSalesVoiceNote,
  type SalesDayUser
} from "./permissions";
import type { SalesDayReviewInput, SalesTaskInput, SalesTaskUpdateInput, SalesTextNoteInput } from "./validators";

type IdResult = { id: string };
type OwnedRecord = { id: string; ownerId: string };
type TenantMemberDb = {
  $queryRaw?<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};
type RelatedRecordModel = {
  findFirst: (args: { where: { id: string; organizationId: string }; select: { id: true } }) => Promise<{ id: string } | null>;
};
type RelatedRecordsDb = TenantMemberDb & {
  leadCustomer?: RelatedRecordModel;
  opportunity?: RelatedRecordModel;
  proposal?: RelatedRecordModel;
  order?: RelatedRecordModel;
  salesTask?: RelatedRecordModel;
};
type TaskForCarryForward = OwnedRecord & {
  leadCustomerId: string | null;
  opportunityId: string | null;
  proposalId: string | null;
  orderId: string | null;
  title: string;
  description: string | null;
  type: SalesTaskType;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
};

type TaskLifecycleDb = TenantMemberDb & {
  salesTask: {
    findFirst: (args: Prisma.SalesTaskFindFirstArgs) => Promise<OwnedRecord | null>;
    update: (args: Prisma.SalesTaskUpdateArgs) => Promise<IdResult>;
  };
};

type CreateTaskDb = RelatedRecordsDb & {
  salesTask: {
    create: (args: Prisma.SalesTaskCreateArgs) => Promise<IdResult>;
  };
};

type UpdateTaskDb = TaskLifecycleDb & RelatedRecordsDb;

type CreateTextNoteDb = RelatedRecordsDb & {
  salesTextNote: {
    create: (args: Prisma.SalesTextNoteCreateArgs) => Promise<IdResult>;
  };
};

type TextNoteDb = RelatedRecordsDb & {
  salesTextNote: {
    findFirst: (args: Prisma.SalesTextNoteFindFirstArgs) => Promise<OwnedRecord | null>;
    update: (args: Prisma.SalesTextNoteUpdateArgs) => Promise<IdResult>;
    delete: (args: Prisma.SalesTextNoteDeleteArgs) => Promise<IdResult>;
  };
};

type VoiceNoteInput = {
  id?: string;
  taskId?: string;
  leadCustomerId?: string;
  opportunityId?: string;
  proposalId?: string;
  orderId?: string;
  audioStorageKey: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  durationSeconds?: number;
  retainedUntil?: Date;
};

type VoiceNoteDb = RelatedRecordsDb & {
  salesVoiceNote: {
    findFirst: (args: Prisma.SalesVoiceNoteFindFirstArgs) => Promise<OwnedRecord | null>;
    create?: (args: Prisma.SalesVoiceNoteCreateArgs) => Promise<IdResult>;
    update: (args: Prisma.SalesVoiceNoteUpdateArgs) => Promise<IdResult>;
  };
};

type TranscriptResult = {
  transcript: string;
  summary?: string | null;
  customerAsk?: string | null;
  nextStep?: string | null;
};

export type SuggestedVoiceActionInput = {
  title: string;
  description?: string | null;
  type: SalesTaskType;
  suggestedDueAt?: Date | null;
  confidenceLabel?: string | null;
};

type SuggestedActionDb = TenantMemberDb & {
  salesVoiceNote?: {
    findFirst: (args: Prisma.SalesVoiceNoteFindFirstArgs) => Promise<OwnedRecord | null>;
  };
  salesVoiceNoteAction: {
    createMany: (args: Prisma.SalesVoiceNoteActionCreateManyArgs) => Promise<{ count: number }>;
  };
};

type AcceptActionRecord = {
  id: string;
  status: "DRAFT" | "ACCEPTED" | "REJECTED";
  createdTaskId: string | null;
  title: string;
  description: string | null;
  type: SalesTaskType;
  suggestedDueAt: Date | null;
  voiceNote: {
    id: string;
    ownerId: string;
    leadCustomerId: string | null;
    opportunityId: string | null;
    proposalId: string | null;
    orderId: string | null;
  };
};

type AcceptActionDb = TenantMemberDb & {
  salesVoiceNoteAction: {
    findFirst: (args: Prisma.SalesVoiceNoteActionFindFirstArgs) => Promise<AcceptActionRecord | null>;
    update: (args: Prisma.SalesVoiceNoteActionUpdateArgs) => Promise<IdResult>;
  };
  salesTask: {
    create: (args: Prisma.SalesTaskCreateArgs) => Promise<IdResult>;
  };
};

type ReviewDb = TenantMemberDb & {
  salesDayReview: {
    upsert: (args: Prisma.SalesDayReviewUpsertArgs) => Promise<IdResult>;
  };
  salesDayReviewItem: {
    upsert: (args: Prisma.SalesDayReviewItemUpsertArgs) => Promise<IdResult>;
  };
  salesTask: {
    findFirst: (args: Prisma.SalesTaskFindFirstArgs) => Promise<TaskForCarryForward | null>;
    create: (args: Prisma.SalesTaskCreateArgs) => Promise<IdResult>;
    update: (args: Prisma.SalesTaskUpdateArgs) => Promise<IdResult>;
  };
};

function normalizeDateToDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function tomorrowMorning(reviewDate: Date) {
  return new Date(Date.UTC(reviewDate.getUTCFullYear(), reviewDate.getUTCMonth(), reviewDate.getUTCDate() + 1, 9));
}

async function assertActiveSalesDayOwner(database: TenantMemberDb, userId: string) {
  if (!database.$queryRaw) throw new Error("Organization member was not found.");
  await assertTenantMember(database as Required<Pick<TenantMemberDb, "$queryRaw">>, userId, ["OWNER", "ADMIN", "SALES"]);
}

type RelatedRecordInput = {
  taskId?: string | null;
  leadCustomerId?: string | null;
  opportunityId?: string | null;
  proposalId?: string | null;
  orderId?: string | null;
};

async function assertRelatedRecords(database: RelatedRecordsDb, organizationId: string, input: RelatedRecordInput) {
  const references = [
    ["salesTask", input.taskId],
    ["leadCustomer", input.leadCustomerId],
    ["opportunity", input.opportunityId],
    ["proposal", input.proposalId],
    ["order", input.orderId]
  ] as const;

  for (const [model, id] of references) {
    if (!id) continue;
    const record = await database[model]?.findFirst({
      where: { id, organizationId },
      select: { id: true }
    });
    if (!record) throw new Error("Related record was not found.");
  }
}

async function findOwnedTask(database: TaskLifecycleDb, user: SalesDayUser, taskId: string) {
  const task = await database.salesTask.findFirst({
    where: { id: taskId, organizationId: user.organizationId },
    select: { id: true, ownerId: true }
  });

  if (!task) {
    throw new Error("My Day task was not found.");
  }

  await assertActiveSalesDayOwner(database, task.ownerId);
  assertOwnsSalesTask(user, task);
  return task;
}

export async function createSalesTask(
  user: SalesDayUser,
  input: SalesTaskInput,
  database: CreateTaskDb = db as unknown as CreateTaskDb
): Promise<IdResult> {
  if (database === (db as unknown as CreateTaskDb)) return withOrganization(user.organizationId, (tx) => createSalesTask(user, input, tx as unknown as CreateTaskDb));
  assertCanUseSalesWorkspace(user);
  await assertActiveSalesDayOwner(database, user.id);
  await assertRelatedRecords(database, user.organizationId, input);

  return database.salesTask.create({
    data: {
      organizationId: user.organizationId,
      ownerId: user.id,
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      priority: input.priority,
      source: "MANUAL",
      dueAt: input.dueAt ?? null,
      leadCustomerId: input.leadCustomerId ?? null,
      opportunityId: input.opportunityId ?? null,
      proposalId: input.proposalId ?? null,
      orderId: input.orderId ?? null
    },
    select: { id: true }
  });
}

export async function updateSalesTask(
  user: SalesDayUser,
  taskId: string,
  input: SalesTaskUpdateInput,
  database: UpdateTaskDb = db as unknown as UpdateTaskDb
): Promise<IdResult> {
  if (database === (db as unknown as UpdateTaskDb)) return withOrganization(user.organizationId, (tx) => updateSalesTask(user, taskId, input, tx as unknown as UpdateTaskDb));
  await findOwnedTask(database, user, taskId);
  await assertRelatedRecords(database, user.organizationId, input);

  return database.salesTask.update({
    where: { id: taskId },
    data: {
      title: input.title,
      description: input.description,
      type: input.type,
      priority: input.priority,
      dueAt: input.dueAt,
      leadCustomerId: input.leadCustomerId,
      opportunityId: input.opportunityId,
      proposalId: input.proposalId,
      orderId: input.orderId
    },
    select: { id: true }
  });
}

async function assertOwnedTextNote(database: TextNoteDb, user: SalesDayUser, noteId: string) {
  const note = await database.salesTextNote.findFirst({
    where: { id: noteId, organizationId: user.organizationId },
    select: { id: true, ownerId: true }
  });

  if (!note) {
    throw new Error("Typed note was not found.");
  }

  await assertActiveSalesDayOwner(database, note.ownerId);
  assertOwnsSalesTextNote(user, note);
}

function textNoteData(user: SalesDayUser, input: SalesTextNoteInput) {
  return {
    organizationId: user.organizationId,
    body: input.body,
    ownerId: user.id,
    leadCustomerId: input.leadCustomerId ?? null,
    opportunityId: input.opportunityId ?? null,
    proposalId: input.proposalId ?? null,
    orderId: input.orderId ?? null,
    taskId: input.taskId ?? null
  };
}

export async function createSalesTextNote(
  user: SalesDayUser,
  input: SalesTextNoteInput,
  database: CreateTextNoteDb = db as unknown as CreateTextNoteDb
): Promise<IdResult> {
  if (database === (db as unknown as CreateTextNoteDb)) return withOrganization(user.organizationId, (tx) => createSalesTextNote(user, input, tx as unknown as CreateTextNoteDb));
  assertCanUseSalesWorkspace(user);
  await assertActiveSalesDayOwner(database, user.id);
  await assertRelatedRecords(database, user.organizationId, input);

  return database.salesTextNote.create({
    data: textNoteData(user, input),
    select: { id: true }
  });
}

export async function updateSalesTextNote(
  user: SalesDayUser,
  noteId: string,
  input: SalesTextNoteInput,
  database: TextNoteDb = db as unknown as TextNoteDb
): Promise<IdResult> {
  if (database === (db as unknown as TextNoteDb)) return withOrganization(user.organizationId, (tx) => updateSalesTextNote(user, noteId, input, tx as unknown as TextNoteDb));
  await assertOwnedTextNote(database, user, noteId);
  await assertRelatedRecords(database, user.organizationId, input);

  return database.salesTextNote.update({
    where: { id: noteId },
    data: {
      body: input.body,
      leadCustomerId: input.leadCustomerId ?? null,
      opportunityId: input.opportunityId ?? null,
      proposalId: input.proposalId ?? null,
      orderId: input.orderId ?? null,
      taskId: input.taskId ?? null
    },
    select: { id: true }
  });
}

export async function deleteSalesTextNote(
  user: SalesDayUser,
  noteId: string,
  database: TextNoteDb = db as unknown as TextNoteDb
): Promise<IdResult> {
  if (database === (db as unknown as TextNoteDb)) return withOrganization(user.organizationId, (tx) => deleteSalesTextNote(user, noteId, tx as unknown as TextNoteDb));
  await assertOwnedTextNote(database, user, noteId);

  return database.salesTextNote.delete({
    where: { id: noteId },
    select: { id: true }
  });
}

export async function completeSalesTask(
  user: SalesDayUser,
  taskId: string,
  database: TaskLifecycleDb = db as unknown as TaskLifecycleDb
): Promise<IdResult> {
  if (database === (db as unknown as TaskLifecycleDb)) return withOrganization(user.organizationId, (tx) => completeSalesTask(user, taskId, tx as unknown as TaskLifecycleDb));
  await findOwnedTask(database, user, taskId);

  return database.salesTask.update({
    where: { id: taskId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      cancelledAt: null
    },
    select: { id: true }
  });
}

export async function reopenSalesTask(
  user: SalesDayUser,
  taskId: string,
  database: TaskLifecycleDb = db as unknown as TaskLifecycleDb
): Promise<IdResult> {
  if (database === (db as unknown as TaskLifecycleDb)) return withOrganization(user.organizationId, (tx) => reopenSalesTask(user, taskId, tx as unknown as TaskLifecycleDb));
  await findOwnedTask(database, user, taskId);

  return database.salesTask.update({
    where: { id: taskId },
    data: {
      status: "OPEN",
      completedAt: null,
      cancelledAt: null
    },
    select: { id: true }
  });
}

export async function cancelSalesTask(
  user: SalesDayUser,
  taskId: string,
  database: TaskLifecycleDb = db as unknown as TaskLifecycleDb
): Promise<IdResult> {
  if (database === (db as unknown as TaskLifecycleDb)) return withOrganization(user.organizationId, (tx) => cancelSalesTask(user, taskId, tx as unknown as TaskLifecycleDb));
  await findOwnedTask(database, user, taskId);

  return database.salesTask.update({
    where: { id: taskId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      completedAt: null
    },
    select: { id: true }
  });
}

export async function carryForwardSalesTask(
  user: SalesDayUser,
  taskId: string,
  nextDueAt: Date,
  database: ReviewDb = db as unknown as ReviewDb
): Promise<IdResult> {
  if (database === (db as unknown as ReviewDb)) return withOrganization(user.organizationId, (tx) => carryForwardSalesTask(user, taskId, nextDueAt, tx as unknown as ReviewDb));
  const task = await database.salesTask.findFirst({
    where: { id: taskId, organizationId: user.organizationId },
    select: {
      id: true,
      ownerId: true,
      leadCustomerId: true,
      opportunityId: true,
      proposalId: true,
      orderId: true,
      title: true,
      description: true,
      type: true,
      priority: true
    }
  });

  if (!task) {
    throw new Error("My Day task was not found.");
  }

  assertOwnsSalesTask(user, task);
  await assertActiveSalesDayOwner(database, user.id);

  const created = await database.salesTask.create({
    data: {
      organizationId: user.organizationId,
      ownerId: user.id,
      leadCustomerId: task.leadCustomerId,
      opportunityId: task.opportunityId,
      proposalId: task.proposalId,
      orderId: task.orderId,
      title: task.title,
      description: task.description,
      type: task.type,
      priority: task.priority,
      source: "CARRY_FORWARD",
      dueAt: nextDueAt
    },
    select: { id: true }
  });

  await database.salesTask.update({
    where: { id: taskId },
    data: { status: "CARRIED_FORWARD" },
    select: { id: true }
  });

  return created;
}

export async function createSalesVoiceNote(
  user: SalesDayUser,
  input: VoiceNoteInput,
  database: VoiceNoteDb = db as unknown as VoiceNoteDb
): Promise<IdResult> {
  if (database === (db as unknown as VoiceNoteDb)) return withOrganization(user.organizationId, (tx) => createSalesVoiceNote(user, input, tx as unknown as VoiceNoteDb));
  assertCanUseSalesWorkspace(user);
  await assertActiveSalesDayOwner(database, user.id);
  await assertRelatedRecords(database, user.organizationId, input);

  if (!database.salesVoiceNote.create) {
    throw new Error("Voice note storage is not available.");
  }

  return database.salesVoiceNote.create({
    data: {
      organizationId: user.organizationId,
      id: input.id,
      ownerId: user.id,
      taskId: input.taskId ?? null,
      leadCustomerId: input.leadCustomerId ?? null,
      opportunityId: input.opportunityId ?? null,
      proposalId: input.proposalId ?? null,
      orderId: input.orderId ?? null,
      audioStorageKey: input.audioStorageKey,
      originalFileName: input.originalFileName,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
      durationSeconds: input.durationSeconds ?? null,
      retainedUntil: input.retainedUntil ?? null
    },
    select: { id: true }
  });
}

async function assertOwnedVoiceNote(database: VoiceNoteDb, user: SalesDayUser, voiceNoteId: string) {
  const note = await database.salesVoiceNote.findFirst({
    where: { id: voiceNoteId, organizationId: user.organizationId },
    select: { id: true, ownerId: true }
  });

  if (!note) {
    throw new Error("Voice note was not found.");
  }

  await assertActiveSalesDayOwner(database, note.ownerId);
  assertOwnsSalesVoiceNote(user, note);
}

export async function markVoiceNoteTranscribing(
  user: SalesDayUser,
  voiceNoteId: string,
  database: VoiceNoteDb = db as unknown as VoiceNoteDb
): Promise<IdResult> {
  if (database === (db as unknown as VoiceNoteDb)) return withOrganization(user.organizationId, (tx) => markVoiceNoteTranscribing(user, voiceNoteId, tx as unknown as VoiceNoteDb));
  await assertOwnedVoiceNote(database, user, voiceNoteId);

  return database.salesVoiceNote.update({
    where: { id: voiceNoteId },
    data: { status: "TRANSCRIBING", processingError: null },
    select: { id: true }
  });
}

export async function saveVoiceNoteTranscript(
  user: SalesDayUser,
  voiceNoteId: string,
  result: TranscriptResult,
  database: VoiceNoteDb = db as unknown as VoiceNoteDb
): Promise<IdResult> {
  if (database === (db as unknown as VoiceNoteDb)) return withOrganization(user.organizationId, (tx) => saveVoiceNoteTranscript(user, voiceNoteId, result, tx as unknown as VoiceNoteDb));
  await assertOwnedVoiceNote(database, user, voiceNoteId);

  return database.salesVoiceNote.update({
    where: { id: voiceNoteId },
    data: {
      status: "TRANSCRIBED",
      transcript: result.transcript,
      summary: result.summary ?? null,
      customerAsk: result.customerAsk ?? null,
      nextStep: result.nextStep ?? null,
      processingError: null
    },
    select: { id: true }
  });
}

export async function markVoiceNoteFailed(
  user: SalesDayUser,
  voiceNoteId: string,
  message: string,
  database: VoiceNoteDb = db as unknown as VoiceNoteDb
): Promise<IdResult> {
  if (database === (db as unknown as VoiceNoteDb)) return withOrganization(user.organizationId, (tx) => markVoiceNoteFailed(user, voiceNoteId, message, tx as unknown as VoiceNoteDb));
  await assertOwnedVoiceNote(database, user, voiceNoteId);

  return database.salesVoiceNote.update({
    where: { id: voiceNoteId },
    data: { status: "FAILED", processingError: message },
    select: { id: true }
  });
}

export async function createSuggestedActionsForVoiceNote(
  user: SalesDayUser,
  voiceNoteId: string,
  actions: SuggestedVoiceActionInput[],
  database: SuggestedActionDb = db as unknown as SuggestedActionDb
): Promise<{ count: number }> {
  if (database === (db as unknown as SuggestedActionDb)) return withOrganization(user.organizationId, (tx) => createSuggestedActionsForVoiceNote(user, voiceNoteId, actions, tx as unknown as SuggestedActionDb));
  const note = await database.salesVoiceNote?.findFirst({
    where: { id: voiceNoteId, organizationId: user.organizationId, ownerId: user.id },
    select: { id: true, ownerId: true }
  });
  if (database.salesVoiceNote && !note) throw new Error("Voice note was not found.");
  if (note) await assertActiveSalesDayOwner(database, note.ownerId);

  if (actions.length === 0) {
    return { count: 0 };
  }

  return database.salesVoiceNoteAction.createMany({
    data: actions.map((action) => ({
      organizationId: user.organizationId,
      voiceNoteId,
      title: action.title,
      description: action.description ?? null,
      type: action.type,
      suggestedDueAt: action.suggestedDueAt ?? null,
      confidenceLabel: action.confidenceLabel ?? null
    }))
  });
}

export async function acceptSuggestedAction(
  user: SalesDayUser,
  actionId: string,
  database: AcceptActionDb = db as unknown as AcceptActionDb
): Promise<IdResult> {
  if (database === (db as unknown as AcceptActionDb)) return withOrganization(user.organizationId, (tx) => acceptSuggestedAction(user, actionId, tx as unknown as AcceptActionDb));
  assertCanUseSalesWorkspace(user);
  const action = await database.salesVoiceNoteAction.findFirst({
    where: { id: actionId, organizationId: user.organizationId },
    include: { voiceNote: true }
  });

  if (!action) {
    throw new Error("Suggested action was not found.");
  }

  assertOwnsSalesVoiceNote(user, action.voiceNote);
  await assertActiveSalesDayOwner(database, action.voiceNote.ownerId);

  if (action.status === "ACCEPTED" && action.createdTaskId) {
    return { id: action.createdTaskId };
  }

  if (action.status === "REJECTED") {
    throw new Error("Rejected actions cannot be accepted.");
  }

  const createdTask = await database.salesTask.create({
    data: {
      organizationId: user.organizationId,
      ownerId: action.voiceNote.ownerId,
      leadCustomerId: action.voiceNote.leadCustomerId,
      opportunityId: action.voiceNote.opportunityId,
      proposalId: action.voiceNote.proposalId,
      orderId: action.voiceNote.orderId,
      title: action.title,
      description: action.description,
      type: action.type,
      priority: "MEDIUM",
      source: "VOICE_NOTE",
      dueAt: action.suggestedDueAt,
      createdFromNoteId: action.voiceNote.id
    },
    select: { id: true }
  });

  await database.salesVoiceNoteAction.update({
    where: { id: actionId },
    data: { status: "ACCEPTED", acceptedAt: new Date(), createdTaskId: createdTask.id },
    select: { id: true }
  });

  return createdTask;
}

export async function rejectSuggestedAction(
  user: SalesDayUser,
  actionId: string,
  database: TenantMemberDb & Pick<AcceptActionDb, "salesVoiceNoteAction"> = db as unknown as TenantMemberDb & Pick<AcceptActionDb, "salesVoiceNoteAction">
): Promise<IdResult> {
  if (database === (db as unknown as TenantMemberDb & Pick<AcceptActionDb, "salesVoiceNoteAction">)) return withOrganization(user.organizationId, (tx) => rejectSuggestedAction(user, actionId, tx as unknown as TenantMemberDb & Pick<AcceptActionDb, "salesVoiceNoteAction">));
  assertCanUseSalesWorkspace(user);
  const action = await database.salesVoiceNoteAction.findFirst({
    where: { id: actionId, organizationId: user.organizationId },
    include: { voiceNote: true }
  });

  if (!action) {
    throw new Error("Suggested action was not found.");
  }

  assertOwnsSalesVoiceNote(user, action.voiceNote);
  await assertActiveSalesDayOwner(database, action.voiceNote.ownerId);

  return database.salesVoiceNoteAction.update({
    where: { id: actionId },
    data: { status: "REJECTED", rejectedAt: new Date() },
    select: { id: true }
  });
}

async function applyReviewItem(
  user: SalesDayUser,
  taskId: string,
  status: SalesDayReviewItemStatus,
  reviewDate: Date,
  database: ReviewDb
) {
  if (status === "DONE") {
    await completeSalesTask(user, taskId, database);
  } else if (status === "MOVE_TO_TOMORROW") {
    await carryForwardSalesTask(user, taskId, tomorrowMorning(reviewDate), database);
  } else if (status === "CANCEL") {
    await cancelSalesTask(user, taskId, database);
  } else {
    const task = await database.salesTask.findFirst({
      where: { id: taskId, organizationId: user.organizationId },
      select: { id: true, ownerId: true }
    });

    if (!task) {
      throw new Error("My Day task was not found.");
    }

    assertOwnsSalesTask(user, task);
  }
}

export async function saveEndOfDayReview(
  user: SalesDayUser,
  input: SalesDayReviewInput,
  database: ReviewDb = db as unknown as ReviewDb
): Promise<IdResult> {
  if (database === (db as unknown as ReviewDb)) return withOrganization(user.organizationId, (tx) => saveEndOfDayReview(user, input, tx as unknown as ReviewDb));
  assertCanUseSalesWorkspace(user);
  await assertActiveSalesDayOwner(database, user.id);
  const reviewDate = normalizeDateToDay(input.reviewDate);
  const review = await database.salesDayReview.upsert({
    where: { organizationId_ownerId_reviewDate: { organizationId: user.organizationId, ownerId: user.id, reviewDate } },
    create: { organizationId: user.organizationId, ownerId: user.id, reviewDate, notes: input.notes ?? null },
    update: { notes: input.notes ?? null },
    select: { id: true }
  });

  for (const item of input.items) {
    await applyReviewItem(user, item.taskId, item.status, reviewDate, database);
    await database.salesDayReviewItem.upsert({
      where: { organizationId_reviewId_taskId: { organizationId: user.organizationId, reviewId: review.id, taskId: item.taskId } },
      create: {
        organizationId: user.organizationId,
        reviewId: review.id,
        taskId: item.taskId,
        status: item.status,
        note: item.note ?? null
      },
      update: {
        status: item.status,
        note: item.note ?? null
      },
      select: { id: true }
    });
  }

  return review;
}
