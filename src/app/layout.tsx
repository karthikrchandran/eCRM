import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "eCRM",
  description: "Small-team lead-to-cash CRM"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
