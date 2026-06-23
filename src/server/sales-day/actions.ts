"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import {
  acceptSuggestedAction,
  cancelSalesTask,
  completeSalesTask,
  createSalesTask,
  createSalesTextNote,
  deleteSalesTextNote,
  rejectSuggestedAction,
  reopenSalesTask,
  saveEndOfDayReview,
  updateSalesTask,
  updateSalesTextNote
} from "./mutations";
import type { SalesDayActionState } from "./types";
import {
  acceptSuggestedActionSchema,
  salesDayReviewSchema,
  salesTaskInputSchema,
  salesTaskUpdateSchema,
  salesTextNoteInputSchema
} from "./validators";

type FieldErrorSource = {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
};

function fieldErrorState(error: FieldErrorSource): SalesDayActionState {
  const fieldErrors = Object.fromEntries(
    Object.entries(error.flatten().fieldErrors).filter((entry): entry is [string, string[]] => Boolean(entry[1]?.length))
  );

  return { ok: false, fieldErrors };
}

function errorState(error: unknown): SalesDayActionState {
  return { ok: false, message: error instanceof Error ? error.message : "Something went wrong." };
}

export async function createSalesTaskAction(
  _previousState: SalesDayActionState,
  formData: FormData
): Promise<SalesDayActionState> {
  const user = await requireUser();
  const result = salesTaskInputSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    type: formData.get("type"),
    priority: formData.get("priority"),
    dueAt: formData.get("dueAt"),
    leadCustomerId: formData.get("leadCustomerId"),
    opportunityId: formData.get("opportunityId"),
    proposalId: formData.get("proposalId"),
    orderId: formData.get("orderId")
  });

  if (!result.success) {
    return fieldErrorState(result.error);
  }

  try {
    await createSalesTask(user, result.data);
    revalidatePath("/my-day");
    return { ok: true, message: "Task added." };
  } catch (error) {
    return errorState(error);
  }
}

export async function updateSalesTaskAction(
  taskId: string,
  _previousState: SalesDayActionState,
  formData: FormData
): Promise<SalesDayActionState> {
  const user = await requireUser();
  const result = salesTaskUpdateSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    type: formData.get("type"),
    priority: formData.get("priority"),
    dueAt: formData.get("dueAt"),
    leadCustomerId: formData.get("leadCustomerId"),
    opportunityId: formData.get("opportunityId"),
    proposalId: formData.get("proposalId"),
    orderId: formData.get("orderId")
  });

  if (!result.success) {
    return fieldErrorState(result.error);
  }

  try {
    await updateSalesTask(user, taskId, result.data);
    revalidatePath("/my-day");
    return { ok: true, message: "Task updated." };
  } catch (error) {
    return errorState(error);
  }
}

function parseTextNoteForm(formData: FormData) {
  return salesTextNoteInputSchema.safeParse({
    body: formData.get("body"),
    taskId: formData.get("taskId"),
    leadCustomerId: formData.get("leadCustomerId"),
    opportunityId: formData.get("opportunityId"),
    proposalId: formData.get("proposalId"),
    orderId: formData.get("orderId")
  });
}

export async function createSalesTextNoteAction(
  _previousState: SalesDayActionState,
  formData: FormData
): Promise<SalesDayActionState> {
  const user = await requireUser();
  const result = parseTextNoteForm(formData);

  if (!result.success) {
    return fieldErrorState(result.error);
  }

  try {
    await createSalesTextNote(user, result.data);
    revalidatePath("/my-day");
    return { ok: true, message: "Note saved." };
  } catch (error) {
    return errorState(error);
  }
}

export async function updateSalesTextNoteAction(
  noteId: string,
  _previousState: SalesDayActionState,
  formData: FormData
): Promise<SalesDayActionState> {
  const user = await requireUser();
  const result = parseTextNoteForm(formData);

  if (!result.success) {
    return fieldErrorState(result.error);
  }

  try {
    await updateSalesTextNote(user, noteId, result.data);
    revalidatePath("/my-day");
    return { ok: true, message: "Note updated." };
  } catch (error) {
    return errorState(error);
  }
}

export async function deleteSalesTextNoteAction(noteId: string) {
  const user = await requireUser();
  await deleteSalesTextNote(user, noteId);
  revalidatePath("/my-day");
}

export async function completeSalesTaskAction(taskId: string) {
  const user = await requireUser();
  await completeSalesTask(user, taskId);
  revalidatePath("/my-day");
}

export async function reopenSalesTaskAction(taskId: string) {
  const user = await requireUser();
  await reopenSalesTask(user, taskId);
  revalidatePath("/my-day");
}

export async function cancelSalesTaskAction(taskId: string) {
  const user = await requireUser();
  await cancelSalesTask(user, taskId);
  revalidatePath("/my-day");
}

export async function acceptSuggestedActionAction(actionId: string) {
  const user = await requireUser();
  const result = acceptSuggestedActionSchema.safeParse({ actionId });

  if (!result.success) {
    throw new Error("Choose a suggested action.");
  }

  await acceptSuggestedAction(user, result.data.actionId);
  revalidatePath("/my-day");
}

export async function rejectSuggestedActionAction(actionId: string) {
  const user = await requireUser();
  const result = acceptSuggestedActionSchema.safeParse({ actionId });

  if (!result.success) {
    throw new Error("Choose a suggested action.");
  }

  await rejectSuggestedAction(user, result.data.actionId);
  revalidatePath("/my-day");
}

export async function saveEndOfDayReviewAction(
  _previousState: SalesDayActionState,
  formData: FormData
): Promise<SalesDayActionState> {
  const user = await requireUser();
  const taskIds = formData.getAll("taskId").map(String);
  const result = salesDayReviewSchema.safeParse({
    reviewDate: formData.get("reviewDate"),
    notes: formData.get("notes"),
    items: taskIds.map((taskId) => ({
      taskId,
      status: formData.get(`status:${taskId}`),
      note: formData.get(`note:${taskId}`)
    }))
  });

  if (!result.success) {
    return fieldErrorState(result.error);
  }

  try {
    await saveEndOfDayReview(user, result.data);
    revalidatePath("/my-day");
    return { ok: true, message: "End-of-day review saved." };
  } catch (error) {
    return errorState(error);
  }
}
