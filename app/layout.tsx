import type { Metadata } from "next";

import { ThemeProvider } from "@/components/layout/theme-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Arvutitark Price Tracker",
    template: "%s · Arvutitark Price Tracker",
  },
  description:
    "Daily historical price tracking for PC components at Arvutitark, Estonia. RAM first, more categories to follow.",
  applicationName: "Arvutitark Price Tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
