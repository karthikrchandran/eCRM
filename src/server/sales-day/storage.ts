import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAX_VOICE_NOTE_BYTES = 25 * 1024 * 1024;
const VERCEL_BLOB_PREFIX = "vercel-blob:";

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
  organizationId: string;
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

function isVercelBlobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID));
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
    .join("organizations", safePathSegment(input.organizationId), "sales-voice-notes", safePathSegment(input.ownerId), monthSegment(createdAt), `${safePathSegment(input.voiceNoteId)}.${extension}`)
    .replace(/\\/g, "/");

  if (isVercelBlobConfigured()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(storageKey, input.buffer, {
      access: "private",
      allowOverwrite: true,
      contentType: mimeType
    });

    return {
      storageKey: `${VERCEL_BLOB_PREFIX}${blob.pathname}`,
      mimeType,
      fileSizeBytes: input.buffer.byteLength,
      originalFileName: input.originalFileName
    };
  }

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
  if (storageKey.startsWith(VERCEL_BLOB_PREFIX)) {
    const pathname = storageKey.slice(VERCEL_BLOB_PREFIX.length);
    const { get } = await import("@vercel/blob");
    const blob = await get(pathname, { access: "private" });
    if (!blob?.stream) {
      throw new Error("Voice note audio was not found.");
    }
    return Buffer.from(await new Response(blob.stream).arrayBuffer());
  }

  return readFile(path.join(storageRoot(), storageKey));
}

export function contentTypeForAudio(storageKey: string) {
  const pathname = storageKey.startsWith(VERCEL_BLOB_PREFIX) ? storageKey.slice(VERCEL_BLOB_PREFIX.length) : storageKey;
  const extension = path.extname(pathname).replace(".", "").toLowerCase();
  return extensionToMime[extension as keyof typeof extensionToMime] ?? "application/octet-stream";
}
