import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { resolveVm } from "./config.ts";
import { audit, checkBlocked, saveLog, truncate } from "./safety.ts";
import { sshExec, sshPull, sshPush } from "./ssh.ts";
import { sessionKill, sessionPoll, sessionSend, sessionSpawn } from "./tmux.ts";
import { fetchVmInfo, formatVmInfo } from "./vm_info.ts";
import { randomUUID } from "node:crypto";

export const toolSchemas = {
  vm_exec: { command: z.string(), timeoutMs: z.number().optional(), cwd: z.string().optional() },
  vm_session_spawn: { id: z.string(), cmd: z.string().optional() },
  vm_session_send: { id: z.string(), input: z.string() },
  vm_session_poll: { id: z.string(), lines: z.number().optional() },
  vm_file_push: { localPath: z.string(), remotePath: z.string() },
  vm_file_pull: { remotePath: z.string(), localPath: z.string() },
  vm_info: {},
};

export async function runMcp() {
  const server = new McpServer({ name: "vm-connect", version: "0.1.0" });

  server.tool("vm_exec", "Run one-shot command on the active VM over SSH", toolSchemas.vm_exec,
    async ({ command, timeoutMs, cwd }) => {
      const blocked = checkBlocked(command);
      if (blocked) return { content: [{ type: "text" as const, text: blocked }], isError: true };
      const cfg = await resolveVm();
      const r = await sshExec(cfg, command, timeoutMs ?? 60_000, { cwd });
      const full = `$ ${command}\n${r.stdout}${r.stderr}`;
      const t = truncate(full);
      const id = randomUUID().slice(0, 8);
      const log = await saveLog(id, full);
      await audit({ tool: "vm_exec", vm: cfg.name, command, code: r.code, truncated: t.truncated, log });
      return { content: [{ type: "text" as const, text: t.text + `\n[vm:${cfg.name} exit:${r.code}${t.truncated ? ` full:${log}` : ""}]` }] };
    });

  server.tool("vm_session_spawn", "Spawn persistent tmux session on active VM", toolSchemas.vm_session_spawn,
    async ({ id, cmd }) => {
      const cfg = await resolveVm();
      const r = await sessionSpawn(cfg, id, cmd);
      await audit({ tool: "vm_session_spawn", vm: cfg.name, id });
      return { content: [{ type: "text" as const, text: `[vm:${cfg.name}] ${r.stdout.trim()}` }] };
    });

  server.tool("vm_session_send", "Send input to tmux session", toolSchemas.vm_session_send,
    async ({ id, input }) => {
      const cfg = await resolveVm();
      await sessionSend(cfg, id, input);
      await audit({ tool: "vm_session_send", vm: cfg.name, id });
      return { content: [{ type: "text" as const, text: `[vm:${cfg.name}] sent` }] };
    });

  server.tool("vm_session_poll", "Read tmux session output", toolSchemas.vm_session_poll,
    async ({ id, lines }) => {
      const cfg = await resolveVm();
      const r = await sessionPoll(cfg, id, lines ?? 200);
      const t = truncate(r.output);
      return { content: [{ type: "text" as const, text: t.text + `\n[vm:${cfg.name} alive:${r.alive}]` }] };
    });

  server.tool("vm_file_push", "Upload local file to active VM", toolSchemas.vm_file_push,
    async ({ localPath, remotePath }) => {
      const cfg = await resolveVm();
      await sshPush(cfg, localPath, remotePath);
      await audit({ tool: "vm_file_push", vm: cfg.name, localPath, remotePath });
      return { content: [{ type: "text" as const, text: `[vm:${cfg.name}] pushed` }] };
    });

  server.tool("vm_file_pull", "Download file from active VM to local", toolSchemas.vm_file_pull,
    async ({ remotePath, localPath }) => {
      const cfg = await resolveVm();
      await sshPull(cfg, remotePath, localPath);
      await audit({ tool: "vm_file_pull", vm: cfg.name, remotePath, localPath });
      return { content: [{ type: "text" as const, text: `[vm:${cfg.name}] pulled` }] };
    });

  server.tool("vm_info", "Report basic facts about the active VM", toolSchemas.vm_info,
    async () => {
      const cfg = await resolveVm();
      const info = await fetchVmInfo(cfg);
      await audit({ tool: "vm_info", vm: cfg.name });
      return { content: [{ type: "text" as const, text: formatVmInfo(cfg.name, info) }] };
    });

  // keep session_kill as CLI-only to keep MCP surface at 7
  void sessionKill;

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.main) await runMcp();
