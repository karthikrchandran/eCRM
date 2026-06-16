import OpenAI, { toFile } from "openai";
import type { SuggestedVoiceActionInput } from "./mutations";

const TRANSCRIPTION_PROMPT = `Transcribe every spoken word. Do not summarize, omit, or clean up spoken content.
The recording is a sales note for an Indian CRM. Common terms include LMS,
eLearning, VR, AR, proposal, PO, GST, invoice, pricing sheet, demo, storyboard,
voiceover, production, payment follow-up, Acme Learning, and customer follow-up.`;

type TranscribeVoiceNoteAudioInput = {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  apiKey?: string;
  model?: string;
};

export type VoiceNoteTranscriptionResult =
  | {
      ok: true;
      transcript: string;
      summary: string | null;
      customerAsk: string | null;
      nextStep: string | null;
      suggestedActions: SuggestedVoiceActionInput[];
    }
  | {
      ok: false;
      error: string;
    };

function cleanSentence(value: string) {
  return value.trim().replace(/\s+/g, " ").replace(/[.!,;:]+$/, "");
}

function tomorrowFrom(base: Date) {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + 1, 9));
}

function nextWeekFrom(base: Date) {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + 7, 9));
}

function dueDateFromText(text: string, now: Date) {
  const lower = text.toLowerCase();
  if (lower.includes("tomorrow")) {
    return tomorrowFrom(now);
  }

  if (lower.includes("next week")) {
    return nextWeekFrom(now);
  }

  return null;
}

function hasAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

export function extractSuggestedActions(transcript: string, now = new Date()): SuggestedVoiceActionInput[] {
  const lower = transcript.toLowerCase();
  const actions: SuggestedVoiceActionInput[] = [];
  const dueAt = dueDateFromText(lower, now);

  if (hasAny(lower, ["send pricing", "pricing sheet", "send commercial", "send proposal"])) {
    actions.push({
      title: hasAny(lower, ["proposal", "commercial"]) ? "Send proposal" : "Send pricing",
      description: cleanSentence(transcript).slice(0, 280),
      type: "SEND_MATERIAL",
      suggestedDueAt: dueAt,
      confidenceLabel: "medium"
    });
  }

  if (hasAny(lower, ["schedule demo", "book demo", "demo with"])) {
    actions.push({
      title: "Schedule demo",
      description: cleanSentence(transcript).slice(0, 280),
      type: "MEETING",
      suggestedDueAt: dueAt,
      confidenceLabel: "medium"
    });
  }

  if (hasAny(lower, ["follow up", "follow-up", "call tomorrow", "call back"])) {
    actions.push({
      title: hasAny(lower, ["call tomorrow", "call back"]) ? "Call customer" : "Follow up with customer",
      description: cleanSentence(transcript).slice(0, 280),
      type: hasAny(lower, ["call tomorrow", "call back"]) ? "CALL" : "FOLLOW_UP",
      suggestedDueAt: dueAt,
      confidenceLabel: "medium"
    });
  }

  return actions;
}

function summarizeTranscript(transcript: string) {
  const cleaned = cleanSentence(transcript);
  if (!cleaned) return null;
  return cleaned.length > 220 ? `${cleaned.slice(0, 217)}...` : cleaned;
}

function customerAskFromTranscript(transcript: string) {
  const lower = transcript.toLowerCase();
  if (lower.includes("client asked") || lower.includes("customer asked")) {
    return summarizeTranscript(transcript);
  }

  if (hasAny(lower, ["pricing", "proposal", "demo", "follow up", "follow-up", "send"])) {
    return summarizeTranscript(transcript);
  }

  return null;
}

export async function transcribeVoiceNoteAudio(
  input: TranscribeVoiceNoteAudioInput
): Promise<VoiceNoteTranscriptionResult> {
  const apiKey = input.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Transcription provider is not configured." };
  }

  try {
    const client = new OpenAI({ apiKey });
    const file = await toFile(input.buffer, input.fileName, { type: input.mimeType });
    const model = input.model ?? process.env.SALES_VOICE_TRANSCRIBE_MODEL ?? "gpt-4o-transcribe";
    const response = await client.audio.transcriptions.create({
      file,
      model,
      prompt: TRANSCRIPTION_PROMPT,
      response_format: "json"
    });
    const transcript = response.text?.trim() ?? "";
    const suggestedActions = extractSuggestedActions(transcript);

    return {
      ok: true,
      transcript,
      summary: summarizeTranscript(transcript),
      customerAsk: customerAskFromTranscript(transcript),
      nextStep: suggestedActions[0]?.title ?? null,
      suggestedActions
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Transcription failed."
    };
  }
}
