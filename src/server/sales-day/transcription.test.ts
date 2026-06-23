import { describe, expect, it } from "vitest";
import { saveVoiceNoteAudio } from "./storage";
import { extractSuggestedActions, transcribeVoiceNoteAudio } from "./transcription";

describe("sales-day voice storage and transcription", () => {
  it("rejects unsupported voice note MIME types before writing audio", async () => {
    await expect(
      saveVoiceNoteAudio({
        ownerId: "sales_1",
        voiceNoteId: "note_1",
        originalFileName: "note.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("not audio")
      })
    ).rejects.toThrow("Unsupported audio format.");
  });

  it("accepts browser recorder MIME parameters and common mobile audio uploads", async () => {
    const recorded = await saveVoiceNoteAudio({
      ownerId: "sales_1",
      voiceNoteId: "note_recorded",
      originalFileName: "recording.webm",
      mimeType: "audio/webm;codecs=opus",
      buffer: Buffer.from("recorded audio")
    });
    const uploaded = await saveVoiceNoteAudio({
      ownerId: "sales_1",
      voiceNoteId: "note_uploaded",
      originalFileName: "upload.m4a",
      mimeType: "audio/x-m4a",
      buffer: Buffer.from("uploaded audio")
    });

    expect(recorded.mimeType).toBe("audio/webm");
    expect(recorded.storageKey).toMatch(/note_recorded\.webm$/);
    expect(uploaded.mimeType).toBe("audio/mp4");
    expect(uploaded.storageKey).toMatch(/note_uploaded\.m4a$/);
  });

  it("returns a controlled failure when the transcription provider is not configured", async () => {
    const result = await transcribeVoiceNoteAudio({
      fileName: "note.webm",
      mimeType: "audio/webm",
      buffer: Buffer.from("audio"),
      apiKey: ""
    });

    expect(result).toEqual({
      ok: false,
      error: "Transcription provider is not configured."
    });
  });

  it("extracts draft actions for concrete sales follow-ups", () => {
    const actions = extractSuggestedActions(
      "Client said send pricing tomorrow and schedule demo with the academic team next week."
    );

    expect(actions).toEqual([
      expect.objectContaining({
        title: "Send pricing",
        type: "SEND_MATERIAL",
        confidenceLabel: "medium"
      }),
      expect.objectContaining({
        title: "Schedule demo",
        type: "MEETING",
        confidenceLabel: "medium"
      })
    ]);
    expect(actions[0].suggestedDueAt).toBeInstanceOf(Date);
  });

  it("does not extract actions from vague transcript text", () => {
    expect(extractSuggestedActions("Customer sounded positive and we had a good discussion.")).toEqual([]);
  });
});
