import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth/current-user";
import { createSalesVoiceNote } from "@/server/sales-day/mutations";
import { saveVoiceNoteAudio } from "@/server/sales-day/storage";
import { salesVoiceNoteUploadMetadataSchema } from "@/server/sales-day/validators";

export async function POST(request: Request) {
  const user = await requireUser();
  const formData = await request.formData();
  const audio = formData.get("audio");

  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "Choose an audio recording to upload." }, { status: 400 });
  }

  const metadata = salesVoiceNoteUploadMetadataSchema.safeParse({
    taskId: formData.get("taskId"),
    leadCustomerId: formData.get("leadCustomerId"),
    opportunityId: formData.get("opportunityId"),
    proposalId: formData.get("proposalId"),
    orderId: formData.get("orderId"),
    durationSeconds: formData.get("durationSeconds")
  });

  if (!metadata.success) {
    return NextResponse.json({ error: "Voice note metadata is invalid." }, { status: 400 });
  }

  const voiceNoteId = randomUUID();
  const buffer = Buffer.from(await audio.arrayBuffer());
  let saved;
  try {
    saved = await saveVoiceNoteAudio({
      ownerId: user.id,
      voiceNoteId,
      originalFileName: audio.name || "sales-voice-note.webm",
      mimeType: audio.type || "audio/webm",
      buffer
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Voice note upload failed." }, { status: 400 });
  }
  const retainedUntil = new Date();
  retainedUntil.setDate(retainedUntil.getDate() + 30);

  await createSalesVoiceNote(user, {
    id: voiceNoteId,
    ...metadata.data,
    audioStorageKey: saved.storageKey,
    originalFileName: saved.originalFileName,
    mimeType: saved.mimeType,
    fileSizeBytes: saved.fileSizeBytes,
    retainedUntil
  });

  return NextResponse.json({
    voiceNoteId,
    audioUrl: `/my-day/voice-notes/${voiceNoteId}/audio`,
    status: "UPLOADED"
  });
}
