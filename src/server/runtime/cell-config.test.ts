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
    expect(parseRuntimeConfig({ APP_MODE: "cell", CELL_ID: "cell_ara", CELL_KEY: "ara-global", CELL_LIFECYCLE_STATUS: "ACTIVE" })).toEqual({
      mode: "cell",
      cellId: "cell_ara",
      cellKey: "ara-global",
      lifecycleStatus: "ACTIVE"
    });
  });

  it("requires a server-projected lifecycle status for cell runtime", () => {
    expect(() => parseRuntimeConfig({ APP_MODE: "cell", CELL_ID: "cell_ara", CELL_KEY: "ara-global" })).toThrow(
      "CELL_LIFECYCLE_STATUS is required"
    );
  });

  it.each(["SUSPENDED", "OFFBOARDING", "DELETED"])("preserves %s so request authorization can fail closed", (status) => {
    expect(parseRuntimeConfig({
      APP_MODE: "cell",
      CELL_ID: "cell_ara",
      CELL_KEY: "ara-global",
      CELL_LIFECYCLE_STATUS: status
    })).toMatchObject({ lifecycleStatus: status });
  });

  it("allows sessions and business requests only for ACTIVE cell projections", () => {
    expect(isCellRuntimeActive({ mode: "cell", cellId: "cell_ara", cellKey: "ara", lifecycleStatus: "ACTIVE" })).toBe(true);
    expect(isCellRuntimeActive({ mode: "cell", cellId: "cell_ara", cellKey: "ara", lifecycleStatus: "SUSPENDED" })).toBe(false);
  });
});
