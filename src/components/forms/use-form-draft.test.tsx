import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useFormDraft } from "./use-form-draft";

describe("useFormDraft", () => {
  it("restores changed field values after a remount and clears them only after success", () => {
    const { result, unmount } = renderHook(() => useFormDraft("activity:lead_1"));

    act(() => result.current.save({ subject: "Call procurement", body: "Discuss proposal" }));
    unmount();

    const restored = renderHook(() => useFormDraft("activity:lead_1"));
    expect(restored.result.current.values).toEqual({ subject: "Call procurement", body: "Discuss proposal" });

    act(() => restored.result.current.clear());
    expect(restored.result.current.values).toEqual({});
  });
});
