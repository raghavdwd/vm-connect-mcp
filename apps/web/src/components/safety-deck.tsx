"use client";

import React from "react";
import {
  IconShieldLock,
  IconAlertTriangle,
  IconFileScissors,
  IconHistory,
  IconTerminal,
} from "@tabler/icons-react";

export function SafetyDeck() {
  const blocklistPatterns = [
    { rule: "rm -rf /", re: "\\brm\\s+-rf\\s+\\/(?:\\s|$)", reason: "Recursive filesystem destruction" },
    { rule: "mkfs.*", re: "\\bmkfs\\b", reason: "Direct disk formatting" },
    { rule: "dd of=/dev/...", re: "\\bdd\\s+.*of=\\/dev\\/", reason: "Raw block device overwrites" },
    { rule: ":(){ :|:& };:", re: ":\\(\\)\\s*\\{\\s*:|:&\\s*\\}", reason: "Bash memory exhaustion forkbomb" },
    { rule: "shutdown / reboot", re: "\\b(shutdown|reboot|halt)\\b", reason: "Host machine deactivation" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Blocklist Card */}
      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1 rounded bg-red-950/40 border border-red-800/40 text-red-400">
              <IconAlertTriangle size={15} />
            </div>
            <h4 className="font-mono text-xs font-semibold text-zinc-100">
              Command Blocklist
            </h4>
          </div>
          <p className="text-xs text-zinc-400 font-sans leading-relaxed mb-3">
            Destructive commands are intercepted and rejected locally before dispatching SSH packets.
          </p>
          <div className="space-y-1.5 font-mono text-[11px]">
            {blocklistPatterns.map((p) => (
              <div
                key={p.rule}
                className="flex items-center justify-between px-2 py-1 rounded bg-zinc-900/80 border border-zinc-800/60"
              >
                <span className="text-red-400/90 font-medium">{p.rule}</span>
                <span className="text-[10px] text-zinc-500 truncate max-w-[130px]">{p.reason}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 pt-2 border-t border-zinc-900 text-[11px] font-mono text-zinc-500">
          Evaluated via regex in <code>safety.ts</code>
        </div>
      </div>

      {/* Truncation Card */}
      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-400">
              <IconFileScissors size={15} />
            </div>
            <h4 className="font-mono text-xs font-semibold text-zinc-100">
              32k Context Shield
            </h4>
          </div>
          <p className="text-xs text-zinc-400 font-sans leading-relaxed mb-3">
            Stdout streams exceeding 32,000 characters are capped to protect LLM context windows from truncation faults.
          </p>
          <div className="p-3 rounded bg-zinc-900/80 border border-zinc-800/60 font-mono text-[11px] space-y-1.5">
            <div className="text-zinc-400 flex items-center justify-between">
              <span>Threshold cap:</span>
              <span className="text-emerald-400 font-semibold">32,000 chars</span>
            </div>
            <div className="text-zinc-400 flex items-center justify-between">
              <span>Truncate marker:</span>
              <span className="text-zinc-300">...[truncated N chars]</span>
            </div>
            <div className="text-zinc-400 flex items-center justify-between">
              <span>Full dump saved:</span>
              <span className="text-zinc-300">~/.vm-connect/logs/</span>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-2 border-t border-zinc-900 text-[11px] font-mono text-zinc-500">
          Zero token exhaustion crashes
        </div>
      </div>

      {/* Audit Log Card */}
      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
              <IconHistory size={15} />
            </div>
            <h4 className="font-mono text-xs font-semibold text-zinc-100">
              Audit Trail & Multi-VM
            </h4>
          </div>
          <p className="text-xs text-zinc-400 font-sans leading-relaxed mb-3">
            Every tool invocation records an immutable JSONL line with timestamps, tool parameters, and VM profile stamps.
          </p>
          <div className="p-2.5 rounded bg-zinc-900/80 border border-zinc-800/60 font-mono text-[10.5px] text-zinc-300 overflow-x-auto leading-relaxed">
            <div>{"{"}</div>
            <div className="pl-2 text-zinc-400">&quot;ts&quot;: &quot;2026-09-20T14:04:19Z&quot;,</div>
            <div className="pl-2">&quot;tool&quot;: &quot;vm_exec&quot;,</div>
            <div className="pl-2 text-emerald-400">&quot;vm&quot;: &quot;default&quot;,</div>
            <div className="pl-2 text-zinc-400">&quot;cmd&quot;: &quot;uname -a&quot;</div>
            <div>{"}"}</div>
          </div>
        </div>
        <div className="mt-4 pt-2 border-t border-zinc-900 text-[11px] font-mono text-zinc-500">
          Logged to <code>audit.jsonl</code>
        </div>
      </div>
    </div>
  );
}
