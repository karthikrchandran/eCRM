import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAX_VOICE_NOTE_BYTES = 25 * 1024 * 1024;

const mimeToExtension = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/x-m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav"
} as const;

const extensionToMime = {
  webm: "audio/webm",
  mp4: "audio/mp4",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  mpeg: "audio/mpeg",
  mpga: "audio/mpeg",
  wav: "audio/wav"
} as const;

export type SupportedAudioMimeType = keyof typeof mimeToExtension;

export type SaveVoiceNoteAudioInput = {
  ownerId: string;
  voiceNoteId: string;
  originalFileName: string;
  mimeType: string;
  buffer: Buffer;
  now?: Date;
};

function storageRoot() {
  const configured = process.env.SALES_VOICE_STORAGE_DIR || ".local-storage/sales-voice-notes";
  return path.isAbsolute(configured) ? configured : path.join(/* turbopackIgnore: true */ process.cwd(), configured);
}

function safePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function monthSegment(date: Date) {
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
}

function normalizeAudioMimeType(mimeType: string) {
  const normalized = mimeType.split(";")[0]?.trim().toLowerCase();
  if (normalized === "audio/x-m4a" || normalized === "audio/m4a") {
    return "audio/mp4";
  }
  return normalized;
}

function extensionForAudio(input: SaveVoiceNoteAudioInput, mimeType: string) {
  const originalExtension = path.extname(input.originalFileName).replace(".", "").toLowerCase();
  if (mimeType === "audio/mp4" && originalExtension === "m4a") {
    return "m4a";
  }
  return mimeToExtension[mimeType as SupportedAudioMimeType];
}

export function assertSupportedAudio(mimeType: string, sizeBytes: number) {
  const normalized = normalizeAudioMimeType(mimeType);
  if (!normalized || !(normalized in mimeToExtension)) {
    throw new Error("Unsupported audio format.");
  }

  if (sizeBytes > MAX_VOICE_NOTE_BYTES) {
    throw new Error("Voice note audio must be 25 MB or smaller.");
  }
}

export async function saveVoiceNoteAudio(input: SaveVoiceNoteAudioInput) {
  assertSupportedAudio(input.mimeType, input.buffer.byteLength);
  const createdAt = input.now ?? new Date();
  const mimeType = normalizeAudioMimeType(input.mimeType) as SupportedAudioMimeType;
  const extension = extensionForAudio(input, mimeType);
  const storageKey = path
    .join(safePathSegment(input.ownerId), monthSegment(createdAt), `${safePathSegment(input.voiceNoteId)}.${extension}`)
    .replace(/\\/g, "/");
  const absolutePath = path.join(storageRoot(), storageKey);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.buffer);

  return {
    storageKey,
    mimeType,
    fileSizeBytes: input.buffer.byteLength,
    originalFileName: input.originalFileName
  };
}

export async function readVoiceNoteAudio(storageKey: string) {
  return readFile(path.join(storageRoot(), storageKey));
}

export function contentTypeForAudio(storageKey: string) {
  const extension = path.extname(storageKey).replace(".", "").toLowerCase();
  return extensionToMime[extension as keyof typeof extensionToMime] ?? "application/octet-stream";
}
