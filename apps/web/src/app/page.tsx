"use client";

import React, { useState } from "react";
import {
  IconTerminal2,
  IconCopy,
  IconCheck,
  IconBrandGithub,
  IconShieldCheck,
  IconServer,
  IconLayersLinked,
  IconSparkles,
  IconExternalLink,
  IconBolt,
  IconArrowRight,
} from "@tabler/icons-react";
import { TerminalSimulator } from "@/components/terminal-simulator";
import { ToolsSpecTable } from "@/components/tools-spec-table";
import { SafetyDeck } from "@/components/safety-deck";
import { AgentConfigurator } from "@/components/agent-configurator";
import { AgentPromptSetup } from "@/components/agent-prompt-setup";
import { ArchitectureFlow } from "@/components/architecture-flow";

export default function Home() {
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [copiedQuickstart, setCopiedQuickstart] = useState(false);

  const installCmd =
    "curl -fsSL https://raw.githubusercontent.com/raghavdwd/vm-connect-mcp/main/scripts/install.sh | bash";
  const quickstartCmd =
    "vm add default --host <HOST> --user ubuntu --key ~/.ssh/id_ed25519";

  const handleCopyInstall = () => {
    navigator.clipboard.writeText(installCmd);
    setCopiedInstall(true);
    setTimeout(() => setCopiedInstall(false), 2000);
  };

  const handleCopyQuickstart = () => {
    navigator.clipboard.writeText(quickstartCmd);
    setCopiedQuickstart(true);
    setTimeout(() => setCopiedQuickstart(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* Top Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#09090b]/80 border-b border-zinc-800/80">
        <div className="max-w-6xl mx-auto px-4 h-13 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-zinc-900 border border-zinc-800 text-emerald-400">
                <IconTerminal2 size={16} />
              </span>
              <span className="font-mono font-semibold text-sm tracking-tight text-zinc-100">
                vm-connect-mcp
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400">
              v0.1.0
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-[11px] font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>stdio runtime active</span>
            </div>

            <a
              href="https://github.com/raghavdwd/vm-connect-mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <IconBrandGithub size={16} />
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-10 space-y-12">
        {/* Hero Section */}
        <section className="space-y-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400">
              <IconBolt size={13} className="text-emerald-400" />
              <span>Zero daemon on VM • Pure SSH + Tmux</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-100 font-mono">
              BYO Ubuntu VM runtime for coding agents
            </h1>
            <p className="text-sm sm:text-base text-zinc-400 max-w-2xl leading-relaxed">
              Run commands, spawn persistent tmux sessions, transfer files, and inspect host metrics safely over SSH without approval friction. Single binary serving the CLI and Model Context Protocol stdio server.
            </p>
          </div>

          {/* Quick Install Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Install */}
            <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="text-xs font-mono text-zinc-500 select-none">$</span>
                <code className="text-xs font-mono text-emerald-300 truncate">
                  {installCmd}
                </code>
              </div>
              <button
                onClick={handleCopyInstall}
                className="shrink-0 p-1.5 rounded hover:bg-zinc-900 text-zinc-400 hover:text-emerald-400 transition-colors"
                title="Copy install command"
              >
                {copiedInstall ? (
                  <IconCheck size={15} className="text-emerald-400" />
                ) : (
                  <IconCopy size={15} />
                )}
              </button>
            </div>

            {/* Quickstart Add */}
            <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="text-xs font-mono text-zinc-500 select-none">$</span>
                <code className="text-xs font-mono text-zinc-300 truncate">
                  {quickstartCmd}
                </code>
              </div>
              <button
                onClick={handleCopyQuickstart}
                className="shrink-0 p-1.5 rounded hover:bg-zinc-900 text-zinc-400 hover:text-emerald-400 transition-colors"
                title="Copy quickstart command"
              >
                {copiedQuickstart ? (
                  <IconCheck size={15} className="text-emerald-400" />
                ) : (
                  <IconCopy size={15} />
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Hero Interactive Component: Mock Terminal Simulator */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconSparkles size={16} className="text-emerald-400" />
              <h2 className="text-sm font-mono font-semibold uppercase tracking-wider text-zinc-300">
                Interactive Stdio Protocol Simulator
              </h2>
            </div>
            <span className="text-xs font-mono text-zinc-500">
              7 MCP Tools Live Explorer
            </span>
          </div>

          <TerminalSimulator />
        </section>

        {/* Minimalist Spec Matrix (Linear/Raycast style) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconLayersLinked size={16} className="text-emerald-400" />
              <h2 className="text-sm font-mono font-semibold uppercase tracking-wider text-zinc-300">
                MCP Tool Specifications & CLI Matrix
              </h2>
            </div>
            <span className="text-xs font-mono text-zinc-500">
              High-density reference sheet
            </span>
          </div>

          <ToolsSpecTable />
        </section>

        {/* Architecture Pipeline */}
        <section className="space-y-3">
          <ArchitectureFlow />
        </section>

        {/* Safety & Isolation Deck */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <IconShieldCheck size={16} className="text-emerald-400" />
            <h2 className="text-sm font-mono font-semibold uppercase tracking-wider text-zinc-300">
              Deterministic Safety & Sandbox Isolation
            </h2>
          </div>

          <SafetyDeck />
        </section>

        {/* Agent Config Generator */}
        <section className="space-y-3">
          <AgentConfigurator />
        </section>

        {/* One-Prompt Agent Setup */}
        <section className="space-y-3">
          <AgentPromptSetup />
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-zinc-800/80 bg-zinc-950/80 py-8 text-center text-xs font-mono text-zinc-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>vm-connect-mcp</span>
            <span>•</span>
            <span>Zero-approval BYO VM runtime for AI agents</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-zinc-600">Built with Bun & Next.js</span>
            <a
              href="https://github.com/raghavdwd/vm-connect-mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
