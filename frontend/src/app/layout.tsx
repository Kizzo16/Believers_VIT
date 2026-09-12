import type { Metadata } from "next";
import "./globals.css";
import { SentinelProvider } from "@/context/SentinelContext";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Sentinel // Autonomous SRE Platform",
  description: "Autonomous Site Reliability Engineering Agent Command & Control Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#101010] text-[#F5F5F5] antialiased font-sans selection:bg-[#00D068]/30">
        <SentinelProvider>
          <AppShell>{children}</AppShell>
        </SentinelProvider>
      </body>
    </html>
  );
}
