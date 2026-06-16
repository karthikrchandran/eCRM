import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import {
  createSuggestedActionsForVoiceNote,
  markVoiceNoteFailed,
  markVoiceNoteTranscribing,
  saveVoiceNoteTranscript
} from "@/server/sales-day/mutations";
import { assertOwnsSalesVoiceNote } from "@/server/sales-day/permissions";
import { readVoiceNoteAudio } from "@/server/sales-day/storage";
import { transcribeVoiceNoteAudio } from "@/server/sales-day/transcription";

type RouteContext = {
  params: Promise<{ voiceNoteId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const user = await requireUser();
  const { voiceNoteId } = await context.params;
  const note = await db.salesVoiceNote.findUnique({
    where: { id: voiceNoteId },
    select: {
      id: true,
      ownerId: true,
      audioStorageKey: true,
      originalFileName: true,
      mimeType: true
    }
  });

  if (!note) {
    return NextResponse.json({ error: "Voice note was not found." }, { status: 404 });
  }

  assertOwnsSalesVoiceNote(user, note);
  await markVoiceNoteTranscribing(user, voiceNoteId);

  const audio = await readVoiceNoteAudio(note.audioStorageKey);
  const result = await transcribeVoiceNoteAudio({
    fileName: note.originalFileName,
    mimeType: note.mimeType,
    buffer: audio
  });

  if (!result.ok) {
    await markVoiceNoteFailed(user, voiceNoteId, result.error);
    revalidatePath("/my-day");
    return NextResponse.json({ voiceNoteId, status: "FAILED", error: result.error });
  }

  await saveVoiceNoteTranscript(user, voiceNoteId, result);
  await createSuggestedActionsForVoiceNote(voiceNoteId, result.suggestedActions);
  revalidatePath("/my-day");

  return NextResponse.json({
    voiceNoteId,
    status: "TRANSCRIBED",
    transcript: result.transcript,
    summary: result.summary,
    suggestedActions: result.suggestedActions
  });
}
