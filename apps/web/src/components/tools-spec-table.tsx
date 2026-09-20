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
  IconSearch,
  IconCopy,
  IconCheck,
  IconShield,
  IconFilter,
} from "@tabler/icons-react";

interface ToolSpec {
  name: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  category: "execution" | "session" | "filesystem" | "telemetry";
  description: string;
  executionMode: string;
  params: { name: string; type: string; required: boolean; desc: string }[];
  safety: string;
  cliSyntax: string;
}

const SPEC_DATA: ToolSpec[] = [
  {
    name: "vm_exec",
    icon: IconTerminal2,
    category: "execution",
    description: "Runs one-shot bash command over SSH in login shell environment (-lic)",
    executionMode: "Ephemeral SSH exec channel",
    params: [
      { name: "command", type: "string", required: true, desc: "Bash command line string to run" },
      { name: "cwd", type: "string", required: false, desc: "Working directory on VM (prepends cd &&)" },
      { name: "timeoutMs", type: "number", required: false, desc: "Timeout cap (default: 60,000ms)" },
    ],
    safety: "Blocklist regex check + 32k truncate + audit log",
    cliSyntax: "vm exec -- uname -a",
  },
  {
    name: "vm_session_spawn",
    icon: IconPlayerPlay,
    category: "session",
    description: "Spawns a detached stateful tmux session pane for long-running processes",
    executionMode: "tmux new-session -d -s <id>",
    params: [
      { name: "id", type: "string", required: true, desc: "Unique tmux session identifier" },
      { name: "cmd", type: "string", required: false, desc: "Initial command to execute inside pane" },
    ],
    safety: "Idempotent (returns existing if active) + audit log",
    cliSyntax: "vm session spawn dev-server 'bun run dev'",
  },
  {
    name: "vm_session_send",
    icon: IconKeyboard,
    category: "session",
    description: "Streams keystrokes or commands into a running tmux session via base64 buffer",
    executionMode: "tmux load-buffer + paste-buffer",
    params: [
      { name: "id", type: "string", required: true, desc: "Target session ID" },
      { name: "input", type: "string", required: true, desc: "Raw characters or command + Enter" },
    ],
    safety: "Base64 encoded (bypasses shell escape collisions) + audit log",
    cliSyntax: "vm session send dev-server 'git pull'",
  },
  {
    name: "vm_session_poll",
    icon: IconEye,
    category: "session",
    description: "Captures terminal scrollback buffer and reports liveness status of session",
    executionMode: "tmux capture-pane -S -<lines> + has-session",
    params: [
      { name: "id", type: "string", required: true, desc: "Session ID to capture" },
      { name: "lines", type: "number", required: false, desc: "Lines to poll from bottom (default: 200)" },
    ],
    safety: "32,000 character cap + [alive:bool] stamp",
    cliSyntax: "vm session poll dev-server 100",
  },
  {
    name: "vm_file_push",
    icon: IconUpload,
    category: "filesystem",
    description: "Uploads a local file to the remote VM filesystem destination",
    executionMode: "SFTP write stream",
    params: [
      { name: "localPath", type: "string", required: true, desc: "Absolute or relative local file path" },
      { name: "remotePath", type: "string", required: true, desc: "Destination remote file path on VM" },
    ],
    safety: "SFTP buffer chunking + audit log",
    cliSyntax: "vm push ./dist/cli.js /opt/app/cli.js",
  },
  {
    name: "vm_file_pull",
    icon: IconDownload,
    category: "filesystem",
    description: "Downloads a file from the remote VM to the local machine",
    executionMode: "SFTP read stream",
    params: [
      { name: "remotePath", type: "string", required: true, desc: "Source file path on VM" },
      { name: "localPath", type: "string", required: true, desc: "Target destination path on local disk" },
    ],
    safety: "SFTP buffer chunking + audit log",
    cliSyntax: "vm pull /var/log/syslog ./syslog.log",
  },
  {
    name: "vm_info",
    icon: IconGauge,
    category: "telemetry",
    description: "Inspects CPU load, RAM usage, disk headroom, and active tmux sessions",
    executionMode: "Single-roundtrip remote bash probe",
    params: [],
    safety: "Read-only inspection • zero side-effects",
    cliSyntax: "vm info",
  },
];

export function ToolsSpecTable() {
  const [filter, setFilter] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = SPEC_DATA.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(filter.toLowerCase()) ||
      item.description.toLowerCase().includes(filter.toLowerCase()) ||
      item.executionMode.toLowerCase().includes(filter.toLowerCase());
    const matchesCat = activeCategory === "all" || item.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="w-full space-y-4">
      {/* Table Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-1">
        <div className="flex items-center gap-2">
          {["all", "execution", "session", "filesystem", "telemetry"].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-1 text-xs font-mono rounded capitalize transition-colors ${
                activeCategory === cat
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700"
                  : "text-zinc-500 hover:text-zinc-300 border border-transparent"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter spec by tool or mode..."
            className="w-full pl-8 pr-3 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
      </div>

      {/* High-density Spec Matrix */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs divide-y divide-zinc-800/80">
            <thead className="bg-zinc-900/60 text-zinc-400">
              <tr>
                <th className="py-2.5 px-4 font-medium">Tool Name</th>
                <th className="py-2.5 px-4 font-medium hidden md:table-cell">Execution Mode</th>
                <th className="py-2.5 px-4 font-medium">Parameters</th>
                <th className="py-2.5 px-4 font-medium hidden lg:table-cell">Safety Guard</th>
                <th className="py-2.5 px-4 font-medium text-right">CLI Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.map((tool) => {
                const Icon = tool.icon;
                return (
                  <tr key={tool.name} className="hover:bg-zinc-900/40 transition-colors group">
                    {/* Tool Name & Badge */}
                    <td className="py-3 px-4 align-top">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-zinc-900 border border-zinc-800 text-emerald-400">
                          <Icon size={15} />
                        </div>
                        <div>
                          <span className="font-semibold text-zinc-100">{tool.name}</span>
                          <p className="text-[11px] text-zinc-400 font-sans mt-0.5 max-w-xs leading-tight">
                            {tool.description}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Mode */}
                    <td className="py-3 px-4 align-top hidden md:table-cell">
                      <span className="inline-block px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800/80 text-[11px] text-zinc-300">
                        {tool.executionMode}
                      </span>
                    </td>

                    {/* Parameters */}
                    <td className="py-3 px-4 align-top">
                      {tool.params.length === 0 ? (
                        <span className="text-zinc-600 italic text-[11px]">none</span>
                      ) : (
                        <div className="space-y-1">
                          {tool.params.map((p) => (
                            <div key={p.name} className="flex items-baseline gap-1.5 text-[11px]">
                              <span className="text-zinc-300 font-medium">{p.name}</span>
                              <span className="text-zinc-500">({p.type})</span>
                              {p.required && <span className="text-emerald-500 text-[10px]">*</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Safety */}
                    <td className="py-3 px-4 align-top hidden lg:table-cell">
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                        <IconShield size={13} className="text-emerald-400/80 shrink-0" />
                        <span>{tool.safety}</span>
                      </div>
                    </td>

                    {/* CLI Syntax & Copy */}
                    <td className="py-3 px-4 align-top text-right">
                      <div className="inline-flex items-center gap-1 bg-zinc-900/90 border border-zinc-800 px-2 py-1 rounded">
                        <code className="text-[11px] text-zinc-300 select-all">{tool.cliSyntax}</code>
                        <button
                          onClick={() => handleCopy(tool.cliSyntax, tool.name)}
                          className="ml-1 text-zinc-500 hover:text-emerald-400 transition-colors"
                          title="Copy CLI command"
                        >
                          {copiedId === tool.name ? (
                            <IconCheck size={12} className="text-emerald-400" />
                          ) : (
                            <IconCopy size={12} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Metrics */}
        <div className="px-4 py-2 bg-zinc-900/40 border-t border-zinc-800 text-[11px] font-mono text-zinc-500 flex items-center justify-between">
          <span>Showing {filtered.length} of {SPEC_DATA.length} stdio tools</span>
          <span>Zero external agent daemon required</span>
        </div>
      </div>
    </div>
  );
}
