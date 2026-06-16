import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { assertOwnsSalesVoiceNote } from "@/server/sales-day/permissions";
import { contentTypeForAudio, readVoiceNoteAudio } from "@/server/sales-day/storage";

type RouteContext = {
  params: Promise<{ voiceNoteId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireUser();
  const { voiceNoteId } = await context.params;
  const note = await db.salesVoiceNote.findUnique({
    where: { id: voiceNoteId },
    select: { id: true, ownerId: true, audioStorageKey: true, mimeType: true }
  });

  if (!note) {
    return NextResponse.json({ error: "Voice note was not found." }, { status: 404 });
  }

  assertOwnsSalesVoiceNote(user, note);
  const audio = await readVoiceNoteAudio(note.audioStorageKey);

  return new Response(new Uint8Array(audio), {
    headers: {
      "content-type": note.mimeType || contentTypeForAudio(note.audioStorageKey),
      "content-length": String(audio.byteLength),
      "cache-control": "private, max-age=0, must-revalidate"
    }
  });
}
