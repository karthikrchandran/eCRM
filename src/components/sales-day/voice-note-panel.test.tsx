import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VoiceNotePanel } from "./voice-note-panel";
import type { MyDayVoiceNoteRecord } from "@/server/sales-day/types";

vi.mock("@/server/sales-day/actions", () => ({
  acceptSuggestedActionAction: vi.fn(),
  rejectSuggestedActionAction: vi.fn()
}));

function note(overrides: Partial<MyDayVoiceNoteRecord>): MyDayVoiceNoteRecord {
  return {
    id: "note_1",
    taskId: "task_1",
    status: "TRANSCRIBED",
    audioUrl: "/my-day/voice-notes/note_1/audio",
    transcript: "Client asked us to send pricing tomorrow.",
    summary: "Client needs pricing.",
    customerAsk: "Send pricing tomorrow",
    nextStep: "Send pricing",
    processingError: null,
    createdAt: new Date("2026-06-17T10:00:00.000Z"),
    actions: [],
    ...overrides
  };
}

describe("VoiceNotePanel", () => {
  it("explains that voice notes are scoped to the signed-in user and selected date", () => {
    render(<VoiceNotePanel notes={[]} />);

    expect(screen.getByText("No voice notes for this day")).toBeVisible();
    expect(screen.getByText(/Voice notes are personal to the signed-in user/)).toBeVisible();
  });

  it("keeps replay visible when transcription fails", () => {
    render(<VoiceNotePanel notes={[note({ status: "FAILED", transcript: null, processingError: "Provider unavailable" })]} />);

    expect(screen.getByLabelText("Replay voice note note_1")).toHaveAttribute("src", "/my-day/voice-notes/note_1/audio");
    expect(screen.getByText("Provider unavailable")).toBeVisible();
  });

  it("renders draft actions as explicit user-confirmed controls", () => {
    render(
      <VoiceNotePanel
        notes={[
          note({
            actions: [
              {
                id: "action_1",
                title: "Send pricing",
                description: "Send pricing tomorrow",
                type: "SEND_MATERIAL",
                suggestedDueAt: new Date("2026-06-18T09:00:00.000Z"),
                status: "DRAFT",
                confidenceLabel: "medium"
              }
            ]
          })
        ]}
      />
    );

    const action = screen.getByTestId("suggested-action-action_1");
    expect(screen.getByText("Actions are drafts until accepted.")).toBeVisible();
    expect(within(action).getByRole("button", { name: "Create task" })).toBeVisible();
    expect(within(action).getByRole("button", { name: "Reject" })).toBeVisible();
  });

  it("renders transcript text when available", () => {
    render(<VoiceNotePanel notes={[note({ transcript: "Client asked for a VR demo and revised proposal." })]} />);

    expect(screen.getByText("Client asked for a VR demo and revised proposal.")).toBeVisible();
  });
});
