import type { SuggestedVoiceActionInput } from "./mutations";

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

export function buildTranscriptResult(transcript: string) {
  const cleaned = transcript.trim().replace(/\s+/g, " ");
  const suggestedActions = extractSuggestedActions(cleaned);

  return {
    transcript: cleaned,
    summary: summarizeTranscript(cleaned),
    customerAsk: customerAskFromTranscript(cleaned),
    nextStep: suggestedActions[0]?.title ?? null,
    suggestedActions
  };
}
