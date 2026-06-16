import type { Prisma, SalesDayReviewItemStatus, SalesTaskType } from "@prisma/client";
import { db } from "@/server/db";
import {
  assertCanUseSalesWorkspace,
  assertOwnsSalesTask,
  assertOwnsSalesVoiceNote,
  type SalesDayUser
} from "./permissions";
import type { SalesDayReviewInput, SalesTaskInput, SalesTaskUpdateInput } from "./validators";

type IdResult = { id: string };
type OwnedRecord = { id: string; ownerId: string };
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

type TaskLifecycleDb = {
  salesTask: {
    findUnique: (args: Prisma.SalesTaskFindUniqueArgs) => Promise<OwnedRecord | null>;
    update: (args: Prisma.SalesTaskUpdateArgs) => Promise<IdResult>;
  };
};

type CreateTaskDb = {
  salesTask: {
    create: (args: Prisma.SalesTaskCreateArgs) => Promise<IdResult>;
  };
};

type UpdateTaskDb = TaskLifecycleDb;

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

type VoiceNoteDb = {
  salesVoiceNote: {
    findUnique: (args: Prisma.SalesVoiceNoteFindUniqueArgs) => Promise<OwnedRecord | null>;
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

type SuggestedActionDb = {
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

type AcceptActionDb = {
  salesVoiceNoteAction: {
    findUnique: (args: Prisma.SalesVoiceNoteActionFindUniqueArgs) => Promise<AcceptActionRecord | null>;
    update: (args: Prisma.SalesVoiceNoteActionUpdateArgs) => Promise<IdResult>;
  };
  salesTask: {
    create: (args: Prisma.SalesTaskCreateArgs) => Promise<IdResult>;
  };
};

type ReviewDb = {
  salesDayReview: {
    upsert: (args: Prisma.SalesDayReviewUpsertArgs) => Promise<IdResult>;
  };
  salesDayReviewItem: {
    upsert: (args: Prisma.SalesDayReviewItemUpsertArgs) => Promise<IdResult>;
  };
  salesTask: {
    findUnique: (args: Prisma.SalesTaskFindUniqueArgs) => Promise<TaskForCarryForward | null>;
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

async function findOwnedTask(database: TaskLifecycleDb, user: SalesDayUser, taskId: string) {
  const task = await database.salesTask.findUnique({
    where: { id: taskId },
    select: { id: true, ownerId: true }
  });

  if (!task) {
    throw new Error("My Day task was not found.");
  }

  assertOwnsSalesTask(user, task);
  return task;
}

export async function createSalesTask(
  user: SalesDayUser,
  input: SalesTaskInput,
  database: CreateTaskDb = db as unknown as CreateTaskDb
) {
  assertCanUseSalesWorkspace(user);

  return database.salesTask.create({
    data: {
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
) {
  await findOwnedTask(database, user, taskId);

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

export async function completeSalesTask(
  user: SalesDayUser,
  taskId: string,
  database: TaskLifecycleDb = db as unknown as TaskLifecycleDb
) {
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
) {
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
) {
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
) {
  const task = await database.salesTask.findUnique({
    where: { id: taskId },
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

  const created = await database.salesTask.create({
    data: {
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
) {
  assertCanUseSalesWorkspace(user);

  if (!database.salesVoiceNote.create) {
    throw new Error("Voice note storage is not available.");
  }

  return database.salesVoiceNote.create({
    data: {
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
  const note = await database.salesVoiceNote.findUnique({
    where: { id: voiceNoteId },
    select: { id: true, ownerId: true }
  });

  if (!note) {
    throw new Error("Voice note was not found.");
  }

  assertOwnsSalesVoiceNote(user, note);
}

export async function markVoiceNoteTranscribing(
  user: SalesDayUser,
  voiceNoteId: string,
  database: VoiceNoteDb = db as unknown as VoiceNoteDb
) {
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
) {
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
) {
  await assertOwnedVoiceNote(database, user, voiceNoteId);

  return database.salesVoiceNote.update({
    where: { id: voiceNoteId },
    data: { status: "FAILED", processingError: message },
    select: { id: true }
  });
}

export async function createSuggestedActionsForVoiceNote(
  voiceNoteId: string,
  actions: SuggestedVoiceActionInput[],
  database: SuggestedActionDb = db as unknown as SuggestedActionDb
) {
  if (actions.length === 0) {
    return { count: 0 };
  }

  return database.salesVoiceNoteAction.createMany({
    data: actions.map((action) => ({
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
) {
  assertCanUseSalesWorkspace(user);
  const action = await database.salesVoiceNoteAction.findUnique({
    where: { id: actionId },
    include: { voiceNote: true }
  });

  if (!action) {
    throw new Error("Suggested action was not found.");
  }

  assertOwnsSalesVoiceNote(user, action.voiceNote);

  if (action.status === "ACCEPTED" && action.createdTaskId) {
    return { id: action.createdTaskId };
  }

  if (action.status === "REJECTED") {
    throw new Error("Rejected actions cannot be accepted.");
  }

  const createdTask = await database.salesTask.create({
    data: {
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
  database: Pick<AcceptActionDb, "salesVoiceNoteAction"> = db as unknown as Pick<AcceptActionDb, "salesVoiceNoteAction">
) {
  assertCanUseSalesWorkspace(user);
  const action = await database.salesVoiceNoteAction.findUnique({
    where: { id: actionId },
    include: { voiceNote: true }
  });

  if (!action) {
    throw new Error("Suggested action was not found.");
  }

  assertOwnsSalesVoiceNote(user, action.voiceNote);

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
    const task = await database.salesTask.findUnique({
      where: { id: taskId },
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
) {
  assertCanUseSalesWorkspace(user);
  const reviewDate = normalizeDateToDay(input.reviewDate);
  const review = await database.salesDayReview.upsert({
    where: { ownerId_reviewDate: { ownerId: user.id, reviewDate } },
    create: { ownerId: user.id, reviewDate, notes: input.notes ?? null },
    update: { notes: input.notes ?? null },
    select: { id: true }
  });

  for (const item of input.items) {
    await applyReviewItem(user, item.taskId, item.status, reviewDate, database);
    await database.salesDayReviewItem.upsert({
      where: { reviewId_taskId: { reviewId: review.id, taskId: item.taskId } },
      create: {
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
