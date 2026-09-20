"use client";

import React, { useState } from "react";
import {
  IconTerminal2,
  IconPlayerPlay,
  IconKeyboard,
  IconEye,
  IconUpload,
  IconDownload,
  IconGauge,
  IconCopy,
  IconCheck,
  IconPlayerPlayFilled,
  IconShieldCheck,
  IconClock,
  IconChecklist,
} from "@tabler/icons-react";

interface ToolDef {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  summary: string;
  sampleArgs: Record<string, any>;
  generateResponse: (args: Record<string, any>) => {
    stdout: string;
    exitCode: number;
    meta?: Record<string, any>;
  };
}

const TOOLS: ToolDef[] = [
  {
    id: "vm_exec",
    name: "vm_exec",
    icon: IconTerminal2,
    summary: "Execute ephemeral bash command over SSH with -lic environment",
    sampleArgs: { command: "uname -a && uptime", cwd: "/home/ubuntu" },
    generateResponse: (args) => ({
      stdout: `Linux ip-172-31-1-178 7.0.0-1006-aws #6-Ubuntu SMP PREEMPT Tue May 26 12:04:34 UTC 2026 x86_64 GNU/Linux\n 14:04:19 up 42 days, 3:18, 1 user, load average: 0.08, 0.03, 0.01`,
      exitCode: 0,
      meta: { executionMs: 46, cwd: args.cwd || "/home/ubuntu" },
    }),
  },
  {
    id: "vm_session_spawn",
    name: "vm_session_spawn",
    icon: IconPlayerPlay,
    summary: "Spawn detached stateful tmux session pane on remote host",
    sampleArgs: { id: "dev-server", cmd: "bun run dev --port 8080" },
    generateResponse: (args) => ({
      stdout: `spawned\n[session:${args.id || "dev-server"}]\n[tmux:detached]`,
      exitCode: 0,
      meta: { session: args.id, socket: "/tmp/tmux-1000/default" },
    }),
  },
  {
    id: "vm_session_send",
    name: "vm_session_send",
    icon: IconKeyboard,
    summary: "Inject base64 keystrokes & commands into detached tmux pane",
    sampleArgs: { id: "dev-server", input: "git status" },
    generateResponse: (args) => ({
      stdout: `sent ${args.input?.length || 10} bytes\n[target:${args.id || "dev-server"}]`,
      exitCode: 0,
      meta: { base64Bytes: 12 },
    }),
  },
  {
    id: "vm_session_poll",
    name: "vm_session_poll",
    icon: IconEye,
    summary: "Capture buffered screen lines & check liveness of tmux session",
    sampleArgs: { id: "dev-server", lines: 50 },
    generateResponse: (args) => ({
      stdout: `[server] Ready on http://localhost:8080\n[server] compiled in 312ms\n[alive:true]`,
      exitCode: 0,
      meta: { alive: true, capturedLines: args.lines || 50 },
    }),
  },
  {
    id: "vm_file_push",
    name: "vm_file_push",
    icon: IconUpload,
    summary: "Push local file to remote VM destination via SFTP",
    sampleArgs: { localPath: "./dist/cli.js", remotePath: "/opt/vm-connect/cli.js" },
    generateResponse: (args) => ({
      stdout: `pushed ${args.localPath || "file"} -> ${args.remotePath || "/dest"}\n[bytes:742153]`,
      exitCode: 0,
      meta: { status: "success", speed: "18.4 MB/s" },
    }),
  },
  {
    id: "vm_file_pull",
    name: "vm_file_pull",
    icon: IconDownload,
    summary: "Pull remote file or log bundle to local machine via SFTP",
    sampleArgs: { remotePath: "/var/log/syslog", localPath: "./logs/vm-syslog.log" },
    generateResponse: (args) => ({
      stdout: `pulled ${args.remotePath || "/src"} -> ${args.localPath || "local"}\n[bytes:128400]`,
      exitCode: 0,
      meta: { status: "success", speed: "24.1 MB/s" },
    }),
  },
  {
    id: "vm_info",
    name: "vm_info",
    icon: IconGauge,
    summary: "Probe CPU, memory, disk, and active tmux sessions in 1 roundtrip",
    sampleArgs: {},
    generateResponse: () => ({
      stdout: `CPU: 2 vCPU (Intel Xeon Platinum 8259CL @ 2.50GHz) - 1.8% load\nRAM: 1.4G / 3.8G (36% used)\nDisk: / 8.2G / 39G (21% used)\nTmux Sessions: 1 active (dev-server: 1 windows)\nUptime: 42 days, 3 hours`,
      exitCode: 0,
      meta: { host: "ip-172-31-1-178", os: "Ubuntu 24.04 LTS" },
    }),
  },
];

export function TerminalSimulator() {
  const [activeTab, setActiveTab] = useState<string>("vm_exec");
  const [copied, setCopied] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [argsState, setArgsState] = useState<Record<string, Record<string, any>>>(() => {
    const initial: Record<string, Record<string, any>> = {};
    for (const tool of TOOLS) {
      initial[tool.id] = { ...tool.sampleArgs };
    }
    return initial;
  });

  const currentTool = TOOLS.find((t) => t.id === activeTab) || TOOLS[0];
  const currentArgs = argsState[currentTool.id] || {};

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleArgChange = (key: string, value: any) => {
    setArgsState((prev) => ({
      ...prev,
      [currentTool.id]: {
        ...prev[currentTool.id],
        [key]: value,
      },
    }));
  };

  const handleRun = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
    }, 280);
  };

  const requestJson = JSON.stringify(
    {
      jsonrpc: "2.0",
      id: "call-" + currentTool.id + "-1",
      method: "tools/call",
      params: {
        name: currentTool.name,
        arguments: currentArgs,
      },
    },
    null,
    2
  );

  const mockResult = currentTool.generateResponse(currentArgs);

  const responseJson = JSON.stringify(
    {
      jsonrpc: "2.0",
      id: "call-" + currentTool.id + "-1",
      result: {
        content: [
          {
            type: "text",
            text: mockResult.stdout,
          },
        ],
      },
    },
    null,
    2
  );

  return (
    <div className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 shadow-2xl overflow-hidden">
      {/* Top Window Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/70 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-zinc-700/70 inline-block" />
          <span className="w-3 h-3 rounded-full bg-zinc-700/70 inline-block" />
          <span className="w-3 h-3 rounded-full bg-zinc-700/70 inline-block" />
          <span className="ml-2 font-mono text-xs text-zinc-400">
            stdio :: <span className="text-emerald-400 font-semibold">json-rpc 2.0</span> :: vm-connect
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-[11px] font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>alive: true</span>
          </div>
          <span className="text-xs font-mono text-zinc-500">default (172.31.1.178)</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto px-3 py-2 border-b border-zinc-800/80 bg-zinc-900/30 no-scrollbar">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const isActive = tool.id === activeTab;
          return (
            <button
              key={tool.id}
              onClick={() => setActiveTab(tool.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono transition-all whitespace-nowrap ${
                isActive
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80 border border-transparent"
              }`}
            >
              <Icon size={15} className={isActive ? "text-emerald-400" : "text-zinc-400"} />
              <span>{tool.name}</span>
            </button>
          );
        })}
      </div>

      {/* Simulator Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-zinc-800">
        {/* Left Column: Arguments & Execution */}
        <div className="lg:col-span-5 p-4 flex flex-col justify-between bg-zinc-950/40">
          <div>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="font-mono text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <currentTool.icon size={16} className="text-emerald-400" />
                  {currentTool.name}
                </h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  {currentTool.summary}
                </p>
              </div>
            </div>

            {/* Editable Parameters */}
            <div className="mt-4 space-y-3">
              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                <IconChecklist size={13} />
                <span>Tool Arguments (Zod Schema)</span>
              </div>

              {Object.keys(currentTool.sampleArgs).length === 0 ? (
                <div className="text-xs font-mono text-zinc-500 italic p-3 rounded bg-zinc-900/40 border border-zinc-800/60">
                  No arguments required for this tool.
                </div>
              ) : (
                Object.entries(currentTool.sampleArgs).map(([key, defaultVal]) => (
                  <div key={key} className="space-y-1">
                    <label className="block text-xs font-mono text-zinc-300">
                      {key}{" "}
                      <span className="text-zinc-500 font-normal">
                        ({typeof defaultVal})
                      </span>
                    </label>
                    <input
                      type="text"
                      value={currentArgs[key] ?? ""}
                      onChange={(e) => handleArgChange(key, e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500/60 transition-colors"
                      placeholder={String(defaultVal)}
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-between">
            <button
              onClick={handleRun}
              disabled={isRunning}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-mono text-xs font-semibold transition-all disabled:opacity-50"
            >
              <IconPlayerPlayFilled size={12} className={isRunning ? "animate-spin" : ""} />
              <span>{isRunning ? "Running over SSH..." : "Simulate stdio Call"}</span>
            </button>

            <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1">
              <IconClock size={12} />
              <span>~40ms RTT</span>
            </span>
          </div>
        </div>

        {/* Right Column: Stdio Stream Inspector */}
        <div className="lg:col-span-7 flex flex-col bg-black/60">
          {/* Output Terminal View */}
          <div className="p-4 flex-1 font-mono text-xs space-y-4 overflow-y-auto max-h-[380px]">
            {/* JSON-RPC Request */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1">
                <span>&lt; Agent stdio Request</span>
                <button
                  onClick={() => handleCopy(requestJson, "req")}
                  className="hover:text-zinc-300 transition-colors"
                  title="Copy Request"
                >
                  {copied === "req" ? <IconCheck size={13} className="text-emerald-400" /> : <IconCopy size={13} />}
                </button>
              </div>
              <pre className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800/80 text-zinc-300 overflow-x-auto text-[11px] leading-relaxed">
                {requestJson}
              </pre>
            </div>

            {/* Stdout / Response */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-emerald-400 mb-1 font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  &gt; Remote VM stdout (stdio JSON-RPC response)
                </span>
                <button
                  onClick={() => handleCopy(responseJson, "res")}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                  title="Copy Response"
                >
                  {copied === "res" ? <IconCheck size={13} className="text-emerald-400" /> : <IconCopy size={13} />}
                </button>
              </div>
              <pre className="p-3 rounded bg-zinc-950 border border-emerald-900/30 text-emerald-300 overflow-x-auto text-[11px] leading-relaxed whitespace-pre-wrap">
                {mockResult.stdout}
              </pre>
            </div>
          </div>

          {/* Terminal Bottom Audit Pill */}
          <div className="px-4 py-2 border-t border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between text-[11px] font-mono text-zinc-400">
            <span className="flex items-center gap-1.5">
              <IconShieldCheck size={13} className="text-emerald-400" />
              <span>Safety: blocklist verified • 32k truncate cap active</span>
            </span>
            <span className="text-zinc-500">exit: 0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
