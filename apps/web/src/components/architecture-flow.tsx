"use client";

import React from "react";
import {
  IconRobot,
  IconArrowsExchange,
  IconCpu,
  IconServer,
  IconTerminal2,
  IconShieldCheck,
} from "@tabler/icons-react";

export function ArchitectureFlow() {
  const steps = [
    {
      title: "Agent Prompt",
      subtitle: "Claude / Cursor / Antigravity",
      icon: IconRobot,
      badge: "LLM Client",
    },
    {
      title: "stdio Transport",
      subtitle: "JSON-RPC 2.0 frames",
      icon: IconArrowsExchange,
      badge: "No open ports",
    },
    {
      title: "vm-connect Backend",
      subtitle: "Safety filter & config resolver",
      icon: IconCpu,
      badge: "Local runtime",
    },
    {
      title: "SSH2 Encrypted Channel",
      subtitle: "Port 22 key-based auth",
      icon: IconServer,
      badge: "Zero agent install",
    },
    {
      title: "Ubuntu VM Execution",
      subtitle: "bash -lic / persistent tmux",
      icon: IconTerminal2,
      badge: "Native OS",
    },
  ];

  return (
    <div className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center gap-2 mb-4">
        <IconShieldCheck size={16} className="text-emerald-400" />
        <h4 className="font-mono text-xs font-semibold text-zinc-100">
          Zero-Agent Architecture: Local Stdio to Remote SSH
        </h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              className="relative p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="p-1 rounded bg-zinc-800 border border-zinc-700/60 text-emerald-400">
                    <Icon size={14} />
                  </span>
                  <span className="font-mono text-[10px] text-zinc-500">0{idx + 1}</span>
                </div>
                <h5 className="font-mono text-xs font-semibold text-zinc-200">
                  {step.title}
                </h5>
                <p className="text-[11px] text-zinc-400 font-sans mt-0.5 leading-snug">
                  {step.subtitle}
                </p>
              </div>
              <div className="mt-3">
                <span className="inline-block px-1.5 py-0.5 rounded bg-zinc-800/80 text-[10px] font-mono text-zinc-400">
                  {step.badge}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
