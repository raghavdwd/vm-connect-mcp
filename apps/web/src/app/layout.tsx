import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "vm-connect-mcp — Run Agent Commands on BYO Ubuntu VM",
  description:
    "Zero-overhead CLI + stdio MCP server bridging coding agents (Claude, Cursor, Antigravity) to Ubuntu VMs over SSH & tmux.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark bg-zinc-950 text-zinc-100 antialiased`}
    >
      <body className="min-h-screen flex flex-col font-sans bg-zinc-950 text-zinc-100 selection:bg-emerald-500/20 selection:text-emerald-300">
        {children}
      </body>
    </html>
  );
}
