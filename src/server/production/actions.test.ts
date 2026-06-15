import { describe, expect, it } from "vitest";
import { parseProductionFiltersForTest, parseProductionStageStatusFormForTest } from "./actions";

describe("production actions", () => {
  it("parses production stage status form data", () => {
    const formData = new FormData();
    formData.set("assignedToId", "user_sales");
    formData.set("dueAt", "2026-08-15");
    formData.set("status", "BLOCKED");
    formData.set("noteBody", "Waiting on client inputs");

    const parsed = parseProductionStageStatusFormForTest(formData);

    expect(parsed.ok).toBe(true);
    expect(parsed.ok ? parsed.data.status : null).toBe("BLOCKED");
    expect(parsed.ok ? parsed.data.assignedToId : null).toBe("user_sales");
  });

  it("parses production filters", () => {
    const parsed = parseProductionFiltersForTest({ assignedToId: "", q: " Acme ", status: "" });

    expect(parsed.ok).toBe(true);
    expect(parsed.ok ? parsed.data.q : null).toBe("Acme");
  });
});
