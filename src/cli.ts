#!/usr/bin/env bun
import { Command } from "commander";
import { loadConfig, saveConfig } from "./config.ts";
import { runMcp } from "./mcp.ts";
import { audit, checkBlocked, saveLog, truncate } from "./safety.ts";
import { sshExec, sshPull, sshPush } from "./ssh.ts";
import { sessionKill, sessionPoll, sessionSend, sessionSpawn } from "./tmux.ts";
import { randomUUID } from "node:crypto";

const program = new Command();
program.name("vm-connect").description("Run commands on cloud VM over SSH. Human CLI + agent backend.");

function opts(o: any) {
  return {
    host: o.host as string | undefined,
    port: o.port ? Number(o.port) : undefined,
    user: o.user as string | undefined,
    keyPath: o.key as string | undefined,
  };
}

program
  .command("init")
  .description("Save VM connection config to ~/.vm-connect/config.json")
  .requiredOption("--host <host>")
  .requiredOption("--user <user>")
  .option("--port <port>", "22")
  .option("--key <path>", "SSH private key path")
  .action(async (o) => {
    await saveConfig({ host: o.host, user: o.user, port: Number(o.port ?? 22), keyPath: o.key });
    console.log("saved ~/.vm-connect/config.json");
  });

program
  .command("exec <cmd...>")
  .description("Run one-shot command on VM")
  .option("--host <host>").option("--user <user>").option("--port <port>").option("--key <path>")
  .option("--timeout <ms>", "60000")
  .action(async (cmdParts: string[], o) => {
    const cmd = cmdParts.join(" ");
    const blocked = checkBlocked(cmd);
    if (blocked) {
      console.error(blocked);
      process.exit(1);
    }
    const cfg = await loadConfig(opts(o));
    const r = await sshExec(cfg, cmd, Number(o.timeout ?? 60000));
    const full = `$ ${cmd}\n${r.stdout}${r.stderr}`;
    const t = truncate(full);
    const id = randomUUID().slice(0, 8);
    const logPath = await saveLog(id, full);
    await audit({ tool: "exec", cmd, code: r.code, truncated: t.truncated, log: logPath });
    process.stdout.write(t.text + (t.truncated ? `\n[full log: ${logPath}]` : ""));
    process.exit(r.code);
  });

const sess = program.command("session").description("Stateful tmux sessions on VM");

sess.command("spawn <id> [cmd...]")
  .option("--host <host>").option("--user <user>").option("--port <port>").option("--key <path>")
  .action(async (id: string, cmdParts: string[], o) => {
    const cfg = await loadConfig(opts(o));
    const r = await sessionSpawn(cfg, id, cmdParts.join(" ") || undefined);
    await audit({ tool: "session_spawn", id });
    console.log(r.stdout.trim());
  });

sess.command("send <id> <input...>")
  .option("--host <host>").option("--user <user>").option("--port <port>").option("--key <path>")
  .action(async (id: string, parts: string[], o) => {
    const cfg = await loadConfig(opts(o));
    await sessionSend(cfg, id, parts.join(" "));
    await audit({ tool: "session_send", id });
    console.log("sent");
  });

sess.command("poll <id>")
  .option("--host <host>").option("--user <user>").option("--port <port>").option("--key <path>")
  .option("--lines <n>", "200")
  .action(async (id: string, o) => {
    const cfg = await loadConfig(opts(o));
    const r = await sessionPoll(cfg, id, Number(o.lines ?? 200));
    const t = truncate(r.output);
    process.stdout.write(t.text + `\n[alive: ${r.alive}]`);
  });

sess.command("kill <id>")
  .option("--host <host>").option("--user <user>").option("--port <port>").option("--key <path>")
  .action(async (id: string, o) => {
    const cfg = await loadConfig(opts(o));
    await sessionKill(cfg, id);
    await audit({ tool: "session_kill", id });
    console.log("killed");
  });

program
  .command("push <local> <remote>")
  .option("--host <host>").option("--user <user>").option("--port <port>").option("--key <path>")
  .action(async (local: string, remote: string, o) => {
    const cfg = await loadConfig(opts(o));
    await sshPush(cfg, local, remote);
    await audit({ tool: "file_push", local, remote });
    console.log("pushed");
  });

program
  .command("pull <remote> <local>")
  .option("--host <host>").option("--user <user>").option("--port <port>").option("--key <path>")
  .action(async (remote: string, local: string, o) => {
    const cfg = await loadConfig(opts(o));
    await sshPull(cfg, remote, local);
    await audit({ tool: "file_pull", remote, local });
    console.log("pulled");
  });

program
  .command("ssh")
  .description("Interactive SSH into VM")
  .option("--host <host>").option("--user <user>").option("--port <port>").option("--key <path>")
  .action(async (o) => {
    const cfg = await loadConfig(opts(o));
    const args = ["-p", String(cfg.port ?? 22)];
    if (cfg.keyPath) args.push("-i", cfg.keyPath);
    args.push(`${cfg.user}@${cfg.host}`);
    const proc = Bun.spawn(["ssh", ...args], { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
    await proc.exited;
  });

program.command("mcp", { hidden: true }).action(async () => {
  await runMcp();
});

await program.parseAsync(process.argv);
