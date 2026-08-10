import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceNoteRecorder } from "./voice-note-recorder";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() })
}));

describe("VoiceNoteRecorder", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("opens a modal dialog with an explicit close control", () => {
    render(<VoiceNoteRecorder tasks={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Capture voice note" }));

    expect(screen.getByRole("dialog", { name: "Capture voice note" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));

    expect(screen.queryByRole("dialog", { name: "Capture voice note" })).not.toBeInTheDocument();
  });

  it("saves uploaded audio without calling the server transcription route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ voiceNoteId: "note_1", status: "UPLOADED" })
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<VoiceNoteRecorder tasks={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Capture voice note" }));
    fireEvent.change(screen.getByLabelText("Audio file"), {
      target: {
        files: [new File(["audio"], "call.webm", { type: "audio/webm" })]
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload selected audio" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/my-day/voice-notes", expect.objectContaining({ method: "POST" }));
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain("/transcribe");
  });
});
