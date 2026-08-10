import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { globSync } from "tinyglobby";

const businessRoots = [
  "crm", "sales-day", "opportunities", "products", "proposals", "orders",
  "production", "finance", "reports", "shared-records", "workflow-events"
];

describe("database import boundary", () => {
  it("prevents tenant business repositories from importing the control-plane client", () => {
    const violations = businessRoots.flatMap((root) => globSync(`src/server/${root}/**/*.{ts,tsx}`))
      .filter((file) => !file.endsWith(".test.ts"))
      .filter((file) => readFileSync(path.join(process.cwd(), file), "utf8").includes('@/server/db'));
    expect(violations).toEqual([]);
  });

  it("has no fake database sentinel in runtime source", () => {
    const violations = globSync("src/server/**/*.{ts,tsx}")
      .filter((file) => !file.endsWith(".test.ts"))
      .filter((file) => readFileSync(path.join(process.cwd(), file), "utf8").includes("tenantBoundary"));
    expect(violations).toEqual([]);
  });
});
