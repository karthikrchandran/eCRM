import { describe, expect, it } from "vitest";

import { CellModuleAccessDeniedError, assertCellModuleEnabled } from "./module-access";

describe("cell module authorization", () => {
  it("allows only enabled modules in ACTIVE cell runtime", () => {
    expect(() => assertCellModuleEnabled(
      { mode: "cell", cellId: "cell_ara", cellKey: "ara", lifecycleStatus: "ACTIVE" },
      "crm",
      ["crm", "reports"]
    )).not.toThrow();

    expect(() => assertCellModuleEnabled(
      { mode: "cell", cellId: "cell_ara", cellKey: "ara", lifecycleStatus: "ACTIVE" },
      "finance",
      ["crm", "reports"]
    )).toThrow(CellModuleAccessDeniedError);
  });

  it("fails closed when a cell has no configuration projection", () => {
    expect(() => assertCellModuleEnabled(
      { mode: "cell", cellId: "cell_ara", cellKey: "ara", lifecycleStatus: "ACTIVE" },
      "crm",
      undefined
    )).toThrow("Module crm is not enabled");
  });
});
