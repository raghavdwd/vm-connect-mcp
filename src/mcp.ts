import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.ts";
import { audit, checkBlocked, saveLog, truncate } from "./safety.ts";
import { sshExec, sshPull, sshPush } from "./ssh.ts";
import { sessionKill, sessionPoll, sessionSend, sessionSpawn } from "./tmux.ts";
import { randomUUID } from "node:crypto";

const conn = { host: z.string().optional(), user: z.string().optional(), port: z.number().optional(), keyPath: z.string().optional() };

export async function runMcp() {
  const server = new McpServer({ name: "vm-connect", version: "0.1.0" });

  server.tool("vm_exec", "Run one-shot command on VM over SSH", { command: z.string(), timeoutMs: z.number().optional(), ...conn },
    async ({ command, timeoutMs, host, user, port, keyPath }) => {
      const blocked = checkBlocked(command);
      if (blocked) return { content: [{ type: "text" as const, text: blocked }], isError: true };
      const cfg = await loadConfig({ host, user, port, keyPath });
      const r = await sshExec(cfg, command, timeoutMs ?? 60_000);
      const full = `$ ${command}\n${r.stdout}${r.stderr}`;
      const t = truncate(full);
      const id = randomUUID().slice(0, 8);
      const log = await saveLog(id, full);
      await audit({ tool: "vm_exec", command, code: r.code, truncated: t.truncated, log });
      return { content: [{ type: "text" as const, text: t.text + `\n[exit:${r.code}${t.truncated ? ` full:${log}` : ""}]` }] };
    });

  server.tool("vm_session_spawn", "Spawn persistent tmux session on VM", { id: z.string(), cmd: z.string().optional(), ...conn },
    async ({ id, cmd, host, user, port, keyPath }) => {
      const cfg = await loadConfig({ host, user, port, keyPath });
      const r = await sessionSpawn(cfg, id, cmd);
      await audit({ tool: "vm_session_spawn", id });
      return { content: [{ type: "text" as const, text: r.stdout }] };
    });

  server.tool("vm_session_send", "Send input to tmux session", { id: z.string(), input: z.string(), ...conn },
    async ({ id, input, host, user, port, keyPath }) => {
      const cfg = await loadConfig({ host, user, port, keyPath });
      await sessionSend(cfg, id, input);
      await audit({ tool: "vm_session_send", id });
      return { content: [{ type: "text" as const, text: "sent" }] };
    });

  server.tool("vm_session_poll", "Read tmux session output", { id: z.string(), lines: z.number().optional(), ...conn },
    async ({ id, lines, host, user, port, keyPath }) => {
      const cfg = await loadConfig({ host, user, port, keyPath });
      const r = await sessionPoll(cfg, id, lines ?? 200);
      const t = truncate(r.output);
      return { content: [{ type: "text" as const, text: t.text + `\n[alive:${r.alive}]` }] };
    });

  server.tool("vm_file_push", "Upload local file to VM", { localPath: z.string(), remotePath: z.string(), ...conn },
    async ({ localPath, remotePath, host, user, port, keyPath }) => {
      const cfg = await loadConfig({ host, user, port, keyPath });
      await sshPush(cfg, localPath, remotePath);
      await audit({ tool: "vm_file_push", localPath, remotePath });
      return { content: [{ type: "text" as const, text: "pushed" }] };
    });

  server.tool("vm_file_pull", "Download VM file to local", { remotePath: z.string(), localPath: z.string(), ...conn },
    async ({ remotePath, localPath, host, user, port, keyPath }) => {
      const cfg = await loadConfig({ host, user, port, keyPath });
      await sshPull(cfg, remotePath, localPath);
      await audit({ tool: "vm_file_pull", remotePath, localPath });
      return { content: [{ type: "text" as const, text: "pulled" }] };
    });

  // keep session_kill as CLI-only to keep MCP surface at 6; agents use spawn/send/poll cycle
  void sessionKill;

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.main) await runMcp();
