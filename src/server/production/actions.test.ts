import { describe, expect, it } from "vitest";
import {
  parseProductionFiltersForTest,
  parseProductionStageStatusFormForTest,
  parseProductionTemplateFormForTest,
  parseProductionTemplateStageFormForTest
} from "./actions";

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

  it("parses production template config form data", () => {
    const formData = new FormData();
    formData.set("key", " vr_ar ");
    formData.set("name", "VR / AR");
    formData.set("description", "Immersive production flow");
    formData.set("sortOrder", "30");
    formData.set("active", "on");

    const parsed = parseProductionTemplateFormForTest(formData);

    expect(parsed.ok).toBe(true);
    expect(parsed.ok ? parsed.data.key : null).toBe("vr_ar");
    expect(parsed.ok ? parsed.data.active : null).toBe(true);
    expect(parsed.ok ? parsed.data.sortOrder : null).toBe(30);
  });

  it("parses production template stage config form data", () => {
    const formData = new FormData();
    formData.set("templateId", "template_1");
    formData.set("key", "review");
    formData.set("name", "Review");
    formData.set("required", "on");
    formData.set("defaultDurationDays", "3");
    formData.set("sortOrder", "20");

    const parsed = parseProductionTemplateStageFormForTest(formData);

    expect(parsed.ok).toBe(true);
    expect(parsed.ok ? parsed.data.templateId : null).toBe("template_1");
    expect(parsed.ok ? parsed.data.required : null).toBe(true);
    expect(parsed.ok ? parsed.data.defaultDurationDays : null).toBe(3);
  });
});
