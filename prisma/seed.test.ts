import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("local seed data", () => {
  it("includes a second salesperson and a distinct customer assigned to him", () => {
    const seedSource = readFileSync(join(process.cwd(), "prisma", "seed.ts"), "utf8");

    expect(seedSource).toContain("Arjun Srinivasan");
    expect(seedSource).toContain("sales2@example.com");
    expect(seedSource).toContain("seed_lead_zenith_health");
    expect(seedSource).toContain("ownerId: arjun.id");
  });
});
