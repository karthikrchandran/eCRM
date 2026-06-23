"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MyDayTaskRecord } from "@/server/sales-day/types";

type RecorderState = "idle" | "recording" | "uploading" | "transcribing" | "done" | "error";

export function VoiceNoteRecorder({ tasks }: { tasks: MyDayTaskRecord[] }) {
  const router = useRouter();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<RecorderState>("idle");
  const [message, setMessage] = useState<string>("");
  const [taskId, setTaskId] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);

  function resetDialog() {
    setState("idle");
    setMessage("");
    setAudioFile(null);
  }

  function closeDialog() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setOpen(false);
    resetDialog();
  }

  async function uploadAndTranscribe(audio: Blob, fileName: string) {
    setState("uploading");
    const formData = new FormData();
    formData.set("audio", audio, fileName);
    if (taskId) {
      formData.set("taskId", taskId);
    }

    const uploadResponse = await fetch("/my-day/voice-notes", { method: "POST", body: formData });
    const uploaded = (await uploadResponse.json().catch(() => ({}))) as { voiceNoteId?: string; error?: string };
    if (!uploadResponse.ok || !uploaded.voiceNoteId) {
      throw new Error(uploaded.error ?? "Voice note upload failed.");
    }

    setState("transcribing");
    const transcribeResponse = await fetch(`/my-day/voice-notes/${uploaded.voiceNoteId}/transcribe`, { method: "POST" });
    const transcribed = (await transcribeResponse.json().catch(() => ({}))) as { status?: string; error?: string };
    router.refresh();

    if (!transcribeResponse.ok) {
      throw new Error(transcribed.error ?? "Voice note transcription failed.");
    }

    setState("done");
    setMessage(
      transcribed.status === "FAILED"
        ? `Voice note saved, but transcription needs attention: ${transcribed.error ?? "Provider unavailable."}`
        : "Voice note saved."
    );
  }

  async function startRecording() {
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Recording is not available in this browser. Upload an audio file instead.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (streamRef.current === stream) {
          streamRef.current = null;
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setMessage("");
      setState("recording");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Microphone access failed.");
    }
  }

  async function stopAndUpload() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      return;
    }

    const stopped = new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
    });
    recorder.stop();
    await stopped;

    try {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      if (!blob.size) {
        throw new Error("Recording did not capture audio.");
      }
      await uploadAndTranscribe(blob, "sales-voice-note.webm");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Voice note upload failed.");
    }
  }

  async function uploadSelectedFile() {
    if (!audioFile) {
      setState("error");
      setMessage("Choose an audio file to upload.");
      return;
    }

    try {
      await uploadAndTranscribe(audioFile, audioFile.name);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Voice note upload failed.");
    }
  }

  const busy = state === "recording" || state === "uploading" || state === "transcribing";

  return (
    <>
      <button
        className="crm-button crm-button-primary text-sm"
        onClick={() => {
          resetDialog();
          setOpen(true);
        }}
        type="button"
      >
        Capture voice note
      </button>

      {open ? (
        <div
          aria-labelledby="voice-note-dialog-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          role="dialog"
        >
          <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-950" id="voice-note-dialog-title">
                  Capture voice note
                </h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Record a call note or upload an audio file. The note is saved first, then transcription creates draft follow-up actions.
                </p>
              </div>
              <button aria-label="Close dialog" className="crm-button crm-button-secondary text-sm" onClick={closeDialog} type="button">
                Close
              </button>
            </div>

            <label className="mt-5 flex flex-col gap-1 text-sm font-medium">
              Link to task
              <select className="crm-control" onChange={(event) => setTaskId(event.target.value)} value={taskId}>
                <option value="">No task link</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-[var(--border)] p-4">
                <h4 className="font-semibold text-slate-950">Record now</h4>
                <p className="mt-1 text-sm text-[var(--muted)]">Use the microphone for quick call notes.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="crm-button crm-button-primary text-sm" disabled={busy} onClick={startRecording} type="button">
                    Start recording
                  </button>
                  <button
                    className="crm-button crm-button-secondary text-sm"
                    disabled={state !== "recording"}
                    onClick={stopAndUpload}
                    type="button"
                  >
                    Stop and upload
                  </button>
                </div>
              </div>

              <div className="rounded-md border border-[var(--border)] p-4">
                <h4 className="font-semibold text-slate-950">Upload audio</h4>
                <p className="mt-1 text-sm text-[var(--muted)]">Use this for phone recordings or saved call audio.</p>
                <label className="mt-4 flex flex-col gap-1 text-sm font-medium">
                  Audio file
                  <input
                    accept="audio/*,.m4a,.mp3,.mp4,.wav,.webm"
                    className="rounded-md border border-[var(--border)] px-3 py-2"
                    onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)}
                    type="file"
                  />
                </label>
                <button className="crm-button crm-button-primary mt-4 text-sm" disabled={busy} onClick={uploadSelectedFile} type="button">
                  Upload selected audio
                </button>
              </div>
            </div>

            <p className={`mt-4 text-sm font-medium ${state === "error" ? "text-red-700" : "text-[var(--muted)]"}`} role="status">
              Status: {state}
              {message ? ` | ${message}` : ""}
            </p>
            {state === "done" || state === "error" ? (
              <div className="mt-4 flex justify-end">
                <button className="crm-button crm-button-primary text-sm" onClick={closeDialog} type="button">
                  Close and view notes
                </button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
