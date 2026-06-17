import type { MyDayVoiceNoteRecord } from "@/server/sales-day/types";
import { EmptyState, StatusBadge } from "@/components/ui/sales-primitives";
import { SuggestedActionsPanel } from "./suggested-actions-panel";

function statusTone(status: MyDayVoiceNoteRecord["status"]) {
  if (status === "TRANSCRIBED") return "success" as const;
  if (status === "FAILED") return "danger" as const;
  if (status === "TRANSCRIBING") return "warning" as const;
  return "info" as const;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function VoiceNotePanel({ notes }: { notes: MyDayVoiceNoteRecord[] }) {
  if (!notes.length) {
    return (
      <EmptyState
        title="No voice notes for this day"
        description="Voice notes are personal to the signed-in user and selected date. Sign in as the sales owner or record a call note here to preserve replay, transcript, and draft follow-up actions."
      />
    );
  }

  return (
    <section className="space-y-3">
      {notes.map((note) => (
        <article className="surface p-4" key={note.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Voice note</h3>
              <p className="text-xs text-[var(--muted)]">{formatDate(note.createdAt)}</p>
            </div>
            <StatusBadge tone={statusTone(note.status)}>{note.status}</StatusBadge>
          </div>

          <audio aria-label={`Replay voice note ${note.id}`} className="mt-3 w-full" controls preload="none" src={note.audioUrl} />

          {note.processingError ? <p className="mt-3 text-sm font-medium text-red-700">{note.processingError}</p> : null}
          {note.status === "TRANSCRIBING" ? <p className="mt-3 text-sm text-[var(--muted)]">Transcription is processing.</p> : null}
          {note.summary ? <p className="mt-3 text-sm font-medium text-slate-800">{note.summary}</p> : null}
          {note.customerAsk ? <p className="mt-2 text-sm text-slate-700">Customer ask: {note.customerAsk}</p> : null}
          {note.nextStep ? <p className="mt-1 text-sm text-slate-700">Next step: {note.nextStep}</p> : null}
          {note.transcript ? (
            <label className="mt-3 flex flex-col gap-1 text-sm font-medium">
              Transcript
              <textarea className="crm-control min-h-24" defaultValue={note.transcript} readOnly />
            </label>
          ) : null}

          <SuggestedActionsPanel actions={note.actions} />
        </article>
      ))}
    </section>
  );
}
