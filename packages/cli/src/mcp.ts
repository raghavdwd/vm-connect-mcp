import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getActive, listVms, readVm, resolveVm } from "./config.ts";
import { MAX_EDIT_BYTES, applyEdit, resolveRemote, sliceText } from "./files.ts";
import { audit, checkBlocked, checkPath, checkSensitiveExec, saveLog, truncate } from "./safety.ts";
import { sshExec, sshPull, sshPush, sshReadText, sshSearch, sshWriteText } from "./ssh.ts";
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
  vm_file_read: { remotePath: z.string(), offset: z.number().optional(), limit: z.number().optional(), cwd: z.string().optional() },
  vm_file_edit: { remotePath: z.string(), oldString: z.string(), newString: z.string(), replaceAll: z.boolean().optional(), cwd: z.string().optional() },
  vm_search: { pattern: z.string(), path: z.string().optional(), glob: z.union([z.string(), z.array(z.string())]).optional(), limit: z.number().optional(), cwd: z.string().optional() },
  vm_list: {},
  vm_info: {},
};

export async function runMcp() {
  const server = new McpServer({ name: "vm-connect", version: "0.1.0" });

  server.tool("vm_exec", "Run one-shot command on the active VM over SSH", toolSchemas.vm_exec,
    async ({ command, timeoutMs, cwd }) => {
      const blocked = checkBlocked(command) ?? checkSensitiveExec(command);
      if (blocked) return { content: [{ type: "text" as const, text: blocked }], isError: true };
      const cfg = await resolveVm();
      const r = await sshExec(cfg, command, timeoutMs ?? 60_000, { cwd });
      const full = `$ ${command}\n${r.stdout}${r.stderr}`;
      const t = truncate(full);
      const id = randomUUID().slice(0, 8);
      const log = await saveLog(id, full, { redact: true });
      await audit({ tool: "vm_exec", vm: cfg.name, command, code: r.code, truncated: t.truncated, log });
      return { content: [{ type: "text" as const, text: t.text + `\n[vm:${cfg.name} exit:${r.code}${t.truncated ? ` full:${log}` : ""}]` }] };
    });

  server.tool("vm_session_spawn", "Spawn persistent tmux session on active VM", toolSchemas.vm_session_spawn,
    async ({ id, cmd }) => {
      if (cmd) {
        const blocked = checkBlocked(cmd) ?? checkSensitiveExec(cmd);
        if (blocked) return { content: [{ type: "text" as const, text: blocked }], isError: true };
      }
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
      const bad = checkPath(localPath) ?? checkPath(remotePath);
      if (bad) return { content: [{ type: "text" as const, text: bad }], isError: true };
      const cfg = await resolveVm();
      await sshPush(cfg, localPath, remotePath);
      await audit({ tool: "vm_file_push", vm: cfg.name, localPath, remotePath });
      return { content: [{ type: "text" as const, text: `[vm:${cfg.name}] pushed` }] };
    });

  server.tool("vm_file_pull", "Download file from active VM to local", toolSchemas.vm_file_pull,
    async ({ remotePath, localPath }) => {
      const bad = checkPath(remotePath) ?? checkPath(localPath);
      if (bad) return { content: [{ type: "text" as const, text: bad }], isError: true };
      const cfg = await resolveVm();
      await sshPull(cfg, remotePath, localPath);
      await audit({ tool: "vm_file_pull", vm: cfg.name, remotePath, localPath });
      return { content: [{ type: "text" as const, text: `[vm:${cfg.name}] pulled` }] };
    });

  server.tool("vm_file_read", "Read a text file on the active VM (paged by lines)", toolSchemas.vm_file_read,
    async ({ remotePath, offset, limit, cwd }) => {
      const bad = checkPath(remotePath) ?? (cwd ? checkPath(cwd) : null);
      if (bad) return { content: [{ type: "text" as const, text: bad }], isError: true };
      const cfg = await resolveVm();
      try {
        const content = await sshReadText(cfg, resolveRemote(remotePath, cwd));
        const s = sliceText(content, offset ?? 1, limit ?? 200);
        const t = truncate(s.text);
        return { content: [{ type: "text" as const, text: t.text + `\n[vm:${cfg.name} lines:${s.start}-${s.end}/${s.total}]` }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `[vm:${cfg.name}] ${(e as Error).message}` }], isError: true };
      }
    });

  server.tool("vm_file_edit", "Exact-string edit of a text file on the active VM", toolSchemas.vm_file_edit,
    async ({ remotePath, oldString, newString, replaceAll, cwd }) => {
      const bad = checkPath(remotePath) ?? (cwd ? checkPath(cwd) : null);
      if (bad) return { content: [{ type: "text" as const, text: bad }], isError: true };
      if (Buffer.byteLength(newString, "utf8") > MAX_EDIT_BYTES) {
        return { content: [{ type: "text" as const, text: `write too large — push it instead` }], isError: true };
      }
      const cfg = await resolveVm();
      try {
        const target = resolveRemote(remotePath, cwd);
        const content = await sshReadText(cfg, target);
        const { text, count } = applyEdit(content, oldString, newString, replaceAll ?? false);
        const id = randomUUID().slice(0, 8);
        const backup = await saveLog(`${id}.bak`, content);
        await sshWriteText(cfg, target, text);
        await audit({ tool: "vm_file_edit", vm: cfg.name, remotePath: target, count, backup });
        return { content: [{ type: "text" as const, text: `[vm:${cfg.name}] replaced ${count} occurrence${count === 1 ? "" : "s"} backup:${backup}` }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `[vm:${cfg.name}] ${(e as Error).message}` }], isError: true };
      }
    });

  server.tool("vm_search", "Ripgrep search on the active VM", toolSchemas.vm_search,
    async ({ pattern, path, glob, limit, cwd }) => {
      const bad = (path ? checkPath(path) : null) ?? (cwd ? checkPath(cwd) : null);
      if (bad) return { content: [{ type: "text" as const, text: bad }], isError: true };
      if (!pattern.trim()) return { content: [{ type: "text" as const, text: "pattern must not be empty" }], isError: true };
      const cfg = await resolveVm();
      try {
        const r = await sshSearch(cfg, pattern, { path, glob, limit, cwd });
        const t = truncate((r.stdout + r.stderr).trim() || "(no matches)");
        await audit({ tool: "vm_search", vm: cfg.name, pattern, code: r.code });
        return { content: [{ type: "text" as const, text: t.text + `\n[vm:${cfg.name} exit:${r.code}]` }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `[vm:${cfg.name}] ${(e as Error).message}` }], isError: true };
      }
    });

  server.tool("vm_list", "List registered VMs, '*' marks the active one", toolSchemas.vm_list,
    async () => {
      const names = await listVms();
      if (!names.length) {
        return { content: [{ type: "text" as const, text: "no VMs configured — run: vm add <name> --host H --user U" }] };
      }
      const active = await getActive();
      const lines: string[] = [];
      for (const n of names) {
        const c = await readVm(n);
        lines.push(`${n === active ? "*" : " "} ${c.name} ${c.user}@${c.host}:${c.port ?? 22}`);
      }
      await audit({ tool: "vm_list", count: names.length });
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    });

  server.tool("vm_info", "Report basic facts about the active VM", toolSchemas.vm_info,
    async () => {
      const cfg = await resolveVm();
      const info = await fetchVmInfo(cfg);
      await audit({ tool: "vm_info", vm: cfg.name });
      return { content: [{ type: "text" as const, text: formatVmInfo(cfg.name, info) }] };
    });

  // keep session_kill as CLI-only to keep agent surface tight
  void sessionKill;

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.main) await runMcp();
