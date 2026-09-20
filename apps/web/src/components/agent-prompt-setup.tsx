"use client";

import React, { useState } from "react";
import {
  IconCopy,
  IconCheck,
  IconSparkles,
} from "@tabler/icons-react";

function buildPrompt(host: string, user: string, keyPath: string, vmCmd: string): string {
  return `Set up vm-connect-mcp on this machine so you can run commands on my Ubuntu VM over SSH. Work end to end and guide me whenever you need input.

1. Install: check \`vm --help\`. If missing, install:
   Linux/macOS:
   curl -fsSL https://raw.githubusercontent.com/raghavdwd/vm-connect-mcp/main/scripts/install.sh | bash
   Windows PowerShell:
   irm https://raw.githubusercontent.com/raghavdwd/vm-connect-mcp/main/scripts/install.ps1 | iex
2. Connect: my VM host is ${host}, SSH user is ${user}, private key path is ${keyPath} (if any of these look like placeholders, ASK me for the real values — never ask for key contents). Then run:
   vm add default --host ${host} --user ${user} --key ${keyPath}
   (If the VM already exists: \`vm list\`, then \`vm use <name>\`.)
3. Verify: \`vm info\` and \`vm exec -- uname -a\` must succeed.
4. Self-register: add the MCP stdio server to YOUR OWN agent config (whichever agent you are — opencode, pi, Claude, Cursor, Antigravity, zcode): command \`${vmCmd}\`, args \`["mcp"]\`. If you cannot edit your own config, print the exact JSON snippet for me to paste instead.
5. Confirm: list your MCP tools (expect vm_exec, vm_session_spawn/send/poll, vm_file_push/pull/read/edit, vm_search, vm_list, vm_info), call vm_info, summarize what you can now do, and tell me what to try next.
Rules: never print private key contents; keep host IPs out of docs; refuse .env / .ssh reads and rm-rf-style destructive commands.`;
}

export function AgentPromptSetup() {
  const [host, setHost] = useState<string>("<HOST>");
  const [user, setUser] = useState<string>("ubuntu");
  const [keyPath, setKeyPath] = useState<string>("~/.ssh/id_ed25519");
  const [vmCmd, setVmCmd] = useState<string>("~/.local/bin/vm");
  const [copied, setCopied] = useState<boolean>(false);

  const prompt = buildPrompt(host.trim() || "<HOST>", user.trim() || "ubuntu", keyPath.trim() || "~/.ssh/id_ed25519", vmCmd.trim() || "vm");

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fields = [
    { label: "VM Host", value: host, set: setHost, placeholder: "<HOST>" },
    { label: "SSH User", value: user, set: setUser, placeholder: "ubuntu" },
    { label: "Key Path", value: keyPath, set: setKeyPath, placeholder: "~/.ssh/id_ed25519" },
    { label: "vm Command", value: vmCmd, set: setVmCmd, placeholder: "~/.local/bin/vm" },
  ];

  return (
    <div className="w-full rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900/50 border-b border-zinc-800">
        <IconSparkles size={16} className="text-emerald-400" />
        <span className="font-mono text-xs font-semibold text-zinc-100">
          Agent Prompt Builder — One-Prompt Setup
        </span>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Inputs */}
        <div className="lg:col-span-4 space-y-3 font-mono text-xs">
          {fields.map((f) => (
            <div key={f.label}>
              <label className="block text-zinc-400 mb-1">{f.label}</label>
              <input
                type="text"
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                placeholder={f.placeholder}
                className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-100 focus:outline-none focus:border-emerald-500/60"
              />
            </div>
          ))}
          <p className="text-[11px] text-zinc-500 font-sans">
            Leave <code>&lt;HOST&gt;</code> as-is and the agent will ask you for it.
          </p>
        </div>

        {/* Right Prompt Display */}
        <div className="lg:col-span-8 flex flex-col justify-between">
          <div className="relative">
            <div className="flex items-center justify-between pb-1 text-[11px] font-mono text-zinc-500">
              <span>Paste into any coding agent</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-zinc-400 hover:text-emerald-400 transition-colors"
              >
                {copied ? (
                  <>
                    <IconCheck size={13} className="text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <IconCopy size={13} />
                    <span>Copy Prompt</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 rounded bg-zinc-900/80 border border-zinc-800/80 font-mono text-xs text-zinc-200 overflow-x-auto leading-relaxed whitespace-pre-wrap">
              {prompt}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
