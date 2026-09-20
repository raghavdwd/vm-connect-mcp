"use client";

import React, { useState } from "react";
import {
  IconCopy,
  IconCheck,
  IconCpu,
  IconTerminal,
  IconBrandGithub,
  IconSettings,
} from "@tabler/icons-react";

interface AgentPreset {
  id: string;
  name: string;
  configPath: string;
  formatJson: (cmd: string) => string;
}

const AGENTS: AgentPreset[] = [
  {
    id: "claude",
    name: "Claude Desktop",
    configPath: "~/Library/Application Support/Claude/claude_desktop_config.json",
    formatJson: (cmd) =>
      JSON.stringify(
        {
          mcpServers: {
            "vm-connect": {
              command: cmd,
              args: ["mcp"],
            },
          },
        },
        null,
        2
      ),
  },
  {
    id: "antigravity",
    name: "Antigravity",
    configPath: "~/.gemini/antigravity-cli/mcp/vm-connect/",
    formatJson: (cmd) =>
      JSON.stringify(
        {
          name: "vm-connect",
          command: cmd,
          args: ["mcp"],
          transport: "stdio",
        },
        null,
        2
      ),
  },
  {
    id: "cursor",
    name: "Cursor",
    configPath: "~/.cursor/mcp.json",
    formatJson: (cmd) =>
      JSON.stringify(
        {
          mcpServers: {
            "vm-connect": {
              command: cmd,
              args: ["mcp"],
            },
          },
        },
        null,
        2
      ),
  },
  {
    id: "opencode",
    name: "OpenCode / Pi",
    configPath: "~/.config/opencode/mcp.json",
    formatJson: (cmd) =>
      JSON.stringify(
        {
          servers: [
            {
              name: "vm-connect",
              cmd: cmd,
              args: ["mcp"],
            },
          ],
        },
        null,
        2
      ),
  },
];

export function AgentConfigurator() {
  const [selectedAgent, setSelectedAgent] = useState<string>("claude");
  const [cmdPath, setCmdPath] = useState<string>("vm-connect");
  const [copied, setCopied] = useState<boolean>(false);

  const activeAgent = AGENTS.find((a) => a.id === selectedAgent) || AGENTS[0];
  const generatedConfig = activeAgent.formatJson(cmdPath);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedConfig);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 bg-zinc-900/50 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <IconSettings size={16} className="text-emerald-400" />
          <span className="font-mono text-xs font-semibold text-zinc-100">
            Agent Stdio Registration Generator
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {AGENTS.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent.id)}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                selectedAgent === agent.id
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700"
                  : "text-zinc-400 hover:text-zinc-200 border border-transparent"
              }`}
            >
              {agent.name}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Options */}
        <div className="lg:col-span-4 space-y-3 font-mono text-xs">
          <div>
            <label className="block text-zinc-400 mb-1">Executable Command / Path</label>
            <input
              type="text"
              value={cmdPath}
              onChange={(e) => setCmdPath(e.target.value)}
              placeholder="vm-connect or full binary path"
              className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-100 focus:outline-none focus:border-emerald-500/60"
            />
            <p className="text-[11px] text-zinc-500 mt-1 font-sans">
              Use global <code>vm-connect</code> or point to <code>/path/to/dist/cli.js</code>
            </p>
          </div>

          <div className="p-3 rounded bg-zinc-900/50 border border-zinc-800/80 space-y-1">
            <span className="text-zinc-400 block text-[11px]">Default Config Location:</span>
            <code className="text-zinc-300 block text-[11px] break-all select-all">
              {activeAgent.configPath}
            </code>
          </div>
        </div>

        {/* Right Code Display */}
        <div className="lg:col-span-8 flex flex-col justify-between">
          <div className="relative">
            <div className="flex items-center justify-between pb-1 text-[11px] font-mono text-zinc-500">
              <span>Ready-to-paste JSON</span>
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
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 rounded bg-zinc-900/80 border border-zinc-800/80 font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed">
              {generatedConfig}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
