import { describe, expect, it } from "vitest";

import { isCellRuntimeActive, parseRuntimeConfig } from "./cell-config";

describe("parseRuntimeConfig", () => {
  it("requires a cell ID in cell mode", () => {
    expect(() => parseRuntimeConfig({ APP_MODE: "cell" })).toThrow("CELL_ID is required");
  });

  it("parses platform mode without cell settings", () => {
    expect(parseRuntimeConfig({ APP_MODE: "platform" })).toEqual({ mode: "platform" });
  });

  it("parses required cell settings in cell mode", () => {
    expect(parseRuntimeConfig({ APP_MODE: "cell", CELL_ID: "cell_ara", CELL_KEY: "ara-global" })).toEqual({
      mode: "cell",
      cellId: "cell_ara",
      cellKey: "ara-global"
    });
  });

  it("allows sessions and business requests only from the durable matching ACTIVE projection", async () => {
    const runtime = { mode: "cell", cellId: "cell_ara", cellKey: "ara" } as const;
    await expect(isCellRuntimeActive(runtime, async () => ({ cellId: "cell_ara", lifecycleStatus: "ACTIVE" }))).resolves.toBe(true);
    await expect(isCellRuntimeActive(runtime, async () => ({ cellId: "cell_ara", lifecycleStatus: "SUSPENDED" }))).resolves.toBe(false);
    await expect(isCellRuntimeActive(runtime, async () => undefined)).resolves.toBe(false);
    await expect(isCellRuntimeActive(runtime, async () => ({ cellId: "cell_other", lifecycleStatus: "ACTIVE" }))).resolves.toBe(false);
  });
});
