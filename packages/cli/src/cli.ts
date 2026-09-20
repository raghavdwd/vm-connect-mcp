#!/usr/bin/env bun
import { Command } from "commander";
import { addVm, getActive, listVms, migrateLegacy, readVm, resolveVm, rmVm, setActive } from "./config.ts";
import { runMcp } from "./mcp.ts";
import { audit, checkBlocked, saveLog, truncate } from "./safety.ts";
import { sshExec, sshPull, sshPush } from "./ssh.ts";
import { fetchVmInfo, formatVmInfo } from "./vm_info.ts";
import { sessionKill, sessionPoll, sessionSend, sessionSpawn } from "./tmux.ts";
import { randomUUID } from "node:crypto";

const program = new Command();
program.name("vm-connect").description("Run commands on named VMs over SSH. Human CLI + agent backend.");

const vmOpt = (c: Command) => c.option("--vm <name>", "target this VM instead of the active one");
const cwdOpt = (c: Command) => c.option("--cwd <path>", "working directory for the command");

async function vmFlags(o: { vm?: string }) {
  try {
    return await resolveVm(o.vm);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}

async function saveVmCommand(name: string, o: { host: string; user: string; port?: string; key?: string }) {
  try {
    const activated = await addVm(name, {
      host: o.host,
      user: o.user,
      port: o.port ? Number(o.port) : undefined,
      keyPath: o.key,
    });
    await audit({ tool: "vm_add", vm: name, host: o.host, user: o.user });
    console.log(`added "${name}" (${o.user}@${o.host})${activated ? " — now active" : ""}`);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}

program.command("add <name>").description("Register a VM under a name")
  .requiredOption("--host <host>").requiredOption("--user <user>")
  .option("--port <port>", "22").option("--key <path>", "SSH private key path")
  .action(saveVmCommand);

program.command("init").description("Alias for `vm add default`")
  .requiredOption("--host <host>").requiredOption("--user <user>")
  .option("--port <port>", "22").option("--key <path>", "SSH private key path")
  .action((o) => saveVmCommand("default", o));

program.command("use <name>").description("Set the active VM")
  .action(async (name: string) => {
    try {
      const cfg = await readVm(name);
      await setActive(name);
      await audit({ tool: "vm_use", vm: name });
      console.log(`active VM: ${cfg.name} (${cfg.user}@${cfg.host})`);
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }
  });

program.command("list").description("Show registered VMs, '*' marks active")
  .action(async () => {
    await migrateLegacy();
    const active = await getActive();
    const names = await listVms();
    if (!names.length) { console.log("no VMs configured — run: vm add <name> --host H --user U"); return; }
    const rows: string[][] = [["", "NAME", "HOST", "USER", "PORT"]];
    for (const n of names) { const c = await readVm(n); rows.push([n === active ? "*" : "", c.name, c.host, c.user, String(c.port ?? 22)]); }
    const widths = rows[0].slice(1).map((_, i) => Math.max(...rows.map((r) => r[i + 1].length)));
    for (const r of rows) console.log(r.map((cell, i) => (i === 0 ? cell : cell.padEnd(widths[i - 1]))).join(" ").trimEnd());
  });

program.command("rm <name>").description("Delete a registered VM")
  .action(async (name: string) => {
    try {
      const wasActive = await rmVm(name);
      await audit({ tool: "vm_rm", vm: name });
      console.log(`removed "${name}"${wasActive ? " — no active VM (vm use <name>)" : ""}`);
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }
  });

program.command("info").description("Report basic facts about the active VM")
  .action(async () => {
    const cfg = await vmFlags({});
    const info = await fetchVmInfo(cfg);
    await audit({ tool: "vm_info", vm: cfg.name });
    console.log(formatVmInfo(cfg.name, info));
  });

vmOpt(cwdOpt(
  program.command("exec <cmd...>").description("Run one-shot command on the active VM")
    .option("--timeout <ms>", "60000")
)).action(async (cmdParts: string[], o) => {
  const cmd = cmdParts.join(" ");
  const blocked = checkBlocked(cmd);
  if (blocked) { console.error(blocked); process.exit(1); }
  const cfg = await vmFlags(o);
  const r = await sshExec(cfg, cmd, Number(o.timeout ?? 60000), { cwd: o.cwd });
  const full = `$ ${cmd}\n${r.stdout}${r.stderr}`;
  const t = truncate(full);
  const id = randomUUID().slice(0, 8);
  const logPath = await saveLog(id, full);
  await audit({ tool: "exec", vm: cfg.name, cmd, code: r.code, truncated: t.truncated, log: logPath });
  process.stdout.write(t.text + (t.truncated ? `\n[full log: ${logPath}]` : ""));
  process.exit(r.code);
});

const sess = program.command("session").description("Stateful tmux sessions on the active VM");

vmOpt(cwdOpt(
  sess.command("spawn <id> [cmd...]").description("Create a detached tmux session")
)).action(async (id: string, cmdParts: string[], o) => {
  const cfg = await vmFlags(o);
  const r = await sessionSpawn(cfg, id, cmdParts.join(" ") || undefined);
  await audit({ tool: "session_spawn", vm: cfg.name, id });
  console.log(`[vm:${cfg.name}] ${r.stdout.trim()}`);
});

vmOpt(cwdOpt(
  sess.command("send <id> <input...>").description("Send a line of input to a session")
)).action(async (id: string, parts: string[], o) => {
  const cfg = await vmFlags(o);
  await sessionSend(cfg, id, parts.join(" "));
  await audit({ tool: "session_send", vm: cfg.name, id });
  console.log(`[vm:${cfg.name}] sent`);
});

vmOpt(cwdOpt(
  sess.command("poll <id>").description("Read recent output").option("--lines <n>", "200")
)).action(async (id: string, o) => {
  const cfg = await vmFlags(o);
  const r = await sessionPoll(cfg, id, Number(o.lines ?? 200));
  const t = truncate(r.output);
  process.stdout.write(t.text + `\n[vm:${cfg.name} alive: ${r.alive}]`);
});

vmOpt(
  sess.command("kill <id>").description("Kill a session")
).action(async (id: string, o) => {
  const cfg = await vmFlags(o);
  await sessionKill(cfg, id);
  await audit({ tool: "session_kill", vm: cfg.name, id });
  console.log(`[vm:${cfg.name}] killed`);
});

vmOpt(cwdOpt(
  program.command("push <local> <remote>").description("Upload a local file to the VM")
)).action(async (local: string, remote: string, o) => {
  const cfg = await vmFlags(o);
  await sshPush(cfg, local, remote);
  await audit({ tool: "file_push", vm: cfg.name, local, remote });
  console.log(`[vm:${cfg.name}] pushed`);
});

vmOpt(cwdOpt(
  program.command("pull <remote> <local>").description("Download a VM file to local")
)).action(async (remote: string, local: string, o) => {
  const cfg = await vmFlags(o);
  await sshPull(cfg, remote, local);
  await audit({ tool: "file_pull", vm: cfg.name, remote, local });
  console.log(`[vm:${cfg.name}] pulled`);
});

vmOpt(
  program.command("ssh").description("Interactive SSH into the active VM")
).action(async (o) => {
  const cfg = await vmFlags(o);
  const args = ["-p", String(cfg.port ?? 22)];
  if (cfg.keyPath) args.push("-i", cfg.keyPath);
  args.push(`${cfg.user}@${cfg.host}`);
  const proc = Bun.spawn(["ssh", ...args], { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  await proc.exited;
});

program.command("mcp", { hidden: true }).action(async () => { await runMcp(); });

await program.parseAsync(process.argv);
