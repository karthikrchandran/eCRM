import { describe, expect, it } from "vitest";
import RootLayout, { metadata } from "./layout";

describe("RootLayout", () => {
  it("uses customer-neutral CommitArc metadata", () => {
    expect(metadata.title).toBe("CommitArc");
    expect(metadata.description).toBe(
      "Coordinate customer commitments from commercial decisions through delivery and collections."
    );
    expect(JSON.stringify(metadata)).not.toMatch(/eCRM|ARA Global/i);
  });

  it("suppresses root hydration warnings from browser-injected attributes", () => {
    const layout = RootLayout({ children: <main>Portal</main> });
    const body = layout.props.children;

    expect(layout.props.suppressHydrationWarning).toBe(true);
    expect(body.props.suppressHydrationWarning).toBe(true);
  });
});
