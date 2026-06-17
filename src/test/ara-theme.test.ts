import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "src");
const productionExtensions = new Set([".css", ".tsx"]);
const bannedThemeFragments = [
  "emerald",
  "green",
  "#126b5f",
  "#0f5149",
  "#00d084",
  "#7bdcb5",
  "#5bba67"
];

function extensionOf(filePath: string) {
  const match = filePath.match(/(\.[^.]+)$/);
  return match?.[1] ?? "";
}

function collectProductionUiFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      if (entry === "test") {
        return [];
      }

      return collectProductionUiFiles(fullPath);
    }

    if (!productionExtensions.has(extensionOf(entry)) || entry.includes(".test.")) {
      return [];
    }

    return [fullPath];
  });
}

describe("ARA Global theme", () => {
  it("uses ARA blue and navy tokens without green production UI styles", () => {
    const globals = readFileSync(join(sourceRoot, "app", "globals.css"), "utf8").toLowerCase();

    expect(globals).toContain("--accent: #0067ff");
    expect(globals).toContain("--accent-strong: #005ee9");
    expect(globals).toContain("--brand-navy: #00205f");
    expect(globals).toContain("--surface-tint: #def0ff");

    const offenders = collectProductionUiFiles(sourceRoot).flatMap((filePath) => {
      const contents = readFileSync(filePath, "utf8").toLowerCase();

      return bannedThemeFragments
        .filter((fragment) => contents.includes(fragment))
        .map((fragment) => `${relative(process.cwd(), filePath)}: ${fragment}`);
    });

    expect(offenders).toEqual([]);
  });

  it("does not override link text color utilities globally", () => {
    const globals = readFileSync(join(sourceRoot, "app", "globals.css"), "utf8").toLowerCase();

    expect(globals).not.toMatch(/a\s*\{[^}]*color\s*:/);
  });
});
