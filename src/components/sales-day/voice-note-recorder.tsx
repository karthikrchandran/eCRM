"use client";

import { useRef, useState } from "react";
import type { MyDayTaskRecord } from "@/server/sales-day/types";

type RecorderState = "idle" | "recording" | "uploading" | "transcribing" | "done" | "error";

export function VoiceNoteRecorder({ tasks }: { tasks: MyDayTaskRecord[] }) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [state, setState] = useState<RecorderState>("idle");
  const [message, setMessage] = useState<string>("");
  const [taskId, setTaskId] = useState("");

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
    setState("uploading");

    try {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      const formData = new FormData();
      formData.set("audio", blob, "sales-voice-note.webm");
      if (taskId) {
        formData.set("taskId", taskId);
      }

      const uploadResponse = await fetch("/my-day/voice-notes", { method: "POST", body: formData });
      if (!uploadResponse.ok) {
        throw new Error("Voice note upload failed.");
      }
      const uploaded = (await uploadResponse.json()) as { voiceNoteId: string };
      setState("transcribing");
      const transcribeResponse = await fetch(`/my-day/voice-notes/${uploaded.voiceNoteId}/transcribe`, { method: "POST" });
      if (!transcribeResponse.ok) {
        throw new Error("Voice note transcription failed.");
      }
      setState("done");
      setMessage("Voice note saved.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Voice note upload failed.");
    }
  }

  return (
    <section className="surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Call voice note</h2>
          <p className="text-sm text-[var(--muted)]">Record replayable call notes and create draft actions from the transcript.</p>
        </div>
      </div>

      <label className="mt-4 flex flex-col gap-1 text-sm font-medium">
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

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="crm-button crm-button-primary text-sm" disabled={state === "recording"} onClick={startRecording} type="button">
          Start
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

      <p className="mt-3 text-sm text-[var(--muted)]">
        Status: {state}
        {message ? ` | ${message}` : ""}
      </p>
    </section>
  );
}
