import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CommitArc",
  description: "Coordinate customer commitments from commercial decisions through delivery and collections."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
