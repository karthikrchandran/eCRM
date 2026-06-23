import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VoiceNoteRecorder } from "./voice-note-recorder";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() })
}));

describe("VoiceNoteRecorder", () => {
  it("opens a modal dialog with an explicit close control", () => {
    render(<VoiceNoteRecorder tasks={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Capture voice note" }));

    expect(screen.getByRole("dialog", { name: "Capture voice note" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));

    expect(screen.queryByRole("dialog", { name: "Capture voice note" })).not.toBeInTheDocument();
  });
});
