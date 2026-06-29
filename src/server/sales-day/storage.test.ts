import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const blobPut = vi.fn();
const blobGet = vi.fn();

vi.mock("@vercel/blob", () => ({
  get: blobGet,
  put: blobPut
}));

describe("sales-day voice note storage", () => {
  let tempDir: string;

  beforeEach(async () => {
    blobPut.mockReset();
    blobGet.mockReset();
    delete process.env.BLOB_READ_WRITE_TOKEN;
    tempDir = await mkdtemp(path.join(os.tmpdir(), "ecrm-voice-storage-"));
    process.env.SALES_VOICE_STORAGE_DIR = tempDir;
  });

  afterEach(async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.SALES_VOICE_STORAGE_DIR;
    await rm(tempDir, { force: true, recursive: true });
  });

  it("uses local file storage when Vercel Blob is not configured", async () => {
    const { saveVoiceNoteAudio } = await import("./storage");

    const saved = await saveVoiceNoteAudio({
      ownerId: "sales_1",
      voiceNoteId: "note_1",
      originalFileName: "note.webm",
      mimeType: "audio/webm",
      buffer: Buffer.from("audio"),
      now: new Date("2026-06-23T12:00:00.000Z")
    });

    expect(saved.storageKey).toBe("sales_1/2026-06/note_1.webm");
    expect(blobPut).not.toHaveBeenCalled();
    await expect(readFile(path.join(tempDir, "sales_1", "2026-06", "note_1.webm"), "utf8")).resolves.toBe("audio");
  });

  it("uses private Vercel Blob storage when BLOB_READ_WRITE_TOKEN is configured", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test";
    blobPut.mockResolvedValue({
      pathname: "sales_1/2026-06/note_1.webm",
      url: "https://store.private.blob.vercel-storage.com/sales_1/2026-06/note_1.webm"
    });
    const { saveVoiceNoteAudio } = await import("./storage");

    const saved = await saveVoiceNoteAudio({
      ownerId: "sales_1",
      voiceNoteId: "note_1",
      originalFileName: "note.webm",
      mimeType: "audio/webm",
      buffer: Buffer.from("audio"),
      now: new Date("2026-06-23T12:00:00.000Z")
    });

    expect(saved.storageKey).toBe("vercel-blob:sales_1/2026-06/note_1.webm");
    expect(blobPut).toHaveBeenCalledWith("sales_1/2026-06/note_1.webm", Buffer.from("audio"), {
      access: "private",
      allowOverwrite: true,
      contentType: "audio/webm"
    });
  });
});
