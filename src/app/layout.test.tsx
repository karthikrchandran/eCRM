import { describe, expect, it } from "vitest";
import RootLayout from "./layout";

describe("RootLayout", () => {
  it("suppresses root hydration warnings from browser-injected attributes", () => {
    const layout = RootLayout({ children: <main>Portal</main> });
    const body = layout.props.children;

    expect(layout.props.suppressHydrationWarning).toBe(true);
    expect(body.props.suppressHydrationWarning).toBe(true);
  });
});
