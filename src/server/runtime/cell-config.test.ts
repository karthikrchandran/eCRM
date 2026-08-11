import { describe, expect, it } from "vitest";

import { parseRuntimeConfig } from "./cell-config";

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
});
