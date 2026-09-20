#!/usr/bin/env bun
import { Command } from "commander";
import { addVm, getActive, listVms, migrateLegacy, readVm, resolveVm, rmVm, setActive } from "./config.ts";
import { runMcp } from "./mcp.ts";
import { MAX_EDIT_BYTES, applyEdit, resolveRemote, sliceText } from "./files.ts";
import { audit, checkBlocked, checkPath, checkSensitiveExec, saveLog, truncate } from "./safety.ts";
import { sshExec, sshPull, sshPush, sshReadText, sshSearch, sshWriteText } from "./ssh.ts";
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
  const blocked = checkBlocked(cmd) ?? checkSensitiveExec(cmd);
  if (blocked) { console.error(blocked); process.exit(1); }
  const cfg = await vmFlags(o);
  const r = await sshExec(cfg, cmd, Number(o.timeout ?? 60000), { cwd: o.cwd });
  const full = `$ ${cmd}\n${r.stdout}${r.stderr}`;
  const t = truncate(full);
  const id = randomUUID().slice(0, 8);
  const logPath = await saveLog(id, full, { redact: true });
  await audit({ tool: "exec", vm: cfg.name, cmd, code: r.code, truncated: t.truncated, log: logPath });
  process.stdout.write(t.text + (t.truncated ? `\n[full log: ${logPath}]` : ""));
  process.exit(r.code);
});

const sess = program.command("session").description("Stateful tmux sessions on the active VM");

vmOpt(cwdOpt(
  sess.command("spawn <id> [cmd...]").description("Create a detached tmux session")
)).action(async (id: string, cmdParts: string[], o) => {
  const cfg = await vmFlags(o);
  const cmd = cmdParts.join(" ") || undefined;
  if (cmd) {
    const blocked = checkBlocked(cmd) ?? checkSensitiveExec(cmd);
    if (blocked) { console.error(blocked); process.exit(1); }
  }
  const r = await sessionSpawn(cfg, id, cmd);
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
  const bad = checkPath(local) ?? checkPath(remote);
  if (bad) { console.error(bad); process.exit(1); }
  const cfg = await vmFlags(o);
  await sshPush(cfg, local, remote);
  await audit({ tool: "file_push", vm: cfg.name, local, remote });
  console.log(`[vm:${cfg.name}] pushed`);
});

vmOpt(cwdOpt(
  program.command("pull <remote> <local>").description("Download a VM file to local")
)).action(async (remote: string, local: string, o) => {
  const bad = checkPath(remote) ?? checkPath(local);
  if (bad) { console.error(bad); process.exit(1); }
  const cfg = await vmFlags(o);
  await sshPull(cfg, remote, local);
  await audit({ tool: "file_pull", vm: cfg.name, remote, local });
  console.log(`[vm:${cfg.name}] pulled`);
});

vmOpt(cwdOpt(
  program.command("read <remote>").description("Read a remote text file (paged by lines)")
    .option("--offset <n>", "first line (1-indexed)", "1")
    .option("--lines <n>", "max lines", "200")
)).action(async (remote: string, o) => {
  const bad = checkPath(remote);
  if (bad) { console.error(bad); process.exit(1); }
  const cfg = await vmFlags(o);
  const content = await sshReadText(cfg, resolveRemote(remote, o.cwd));
  const s = sliceText(content, Number(o.offset ?? 1), Number(o.lines ?? 200));
  const t = truncate(s.text);
  process.stdout.write(t.text + `\n[vm:${cfg.name} lines:${s.start}-${s.end}/${s.total}]`);
});

vmOpt(cwdOpt(
  program.command("edit <remote>").description("Exact-string edit of a remote text file")
    .requiredOption("--old <s>", "string to replace")
    .requiredOption("--new <s>", "replacement string")
    .option("--replace-all", "replace every occurrence", false)
)).action(async (remote: string, o) => {
  const bad = checkPath(remote);
  if (bad) { console.error(bad); process.exit(1); }
  if (Buffer.byteLength(o.new, "utf8") > MAX_EDIT_BYTES) { console.error("write too large — push it instead"); process.exit(1); }
  const cfg = await vmFlags(o);
  const target = resolveRemote(remote, o.cwd);
  const content = await sshReadText(cfg, target);
  let result: { text: string; count: number };
  try {
    result = applyEdit(content, o.old, o.new, Boolean(o.replaceAll));
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
  const id = randomUUID().slice(0, 8);
  const backup = await saveLog(`${id}.bak`, content);
  await sshWriteText(cfg, target, result.text);
  await audit({ tool: "file_edit", vm: cfg.name, remotePath: target, count: result.count, backup });
  console.log(`[vm:${cfg.name}] replaced ${result.count} occurrence${result.count === 1 ? "" : "s"} backup:${backup}`);
});

vmOpt(cwdOpt(
  program.command("search <pattern> [path]").description("Ripgrep search on the VM")
    .option("--glob <g>", "glob filter (repeat with comma or multiple flags)")
    .option("--limit <n>", "max matches", "100")
)).action(async (pattern: string, path: string | undefined, o) => {
  if (!pattern.trim()) { console.error("pattern must not be empty"); process.exit(1); }
  const bad = (path ? checkPath(path) : null) ?? (o.cwd ? checkPath(o.cwd) : null);
  if (bad) { console.error(bad); process.exit(1); }
  const cfg = await vmFlags(o);
  const globs: string[] | undefined = o.glob
    ? String(o.glob).split(",").map((g: string) => g.trim()).filter(Boolean)
    : undefined;
  const r = await sshSearch(cfg, pattern, { path, glob: globs, limit: Number(o.limit ?? 100), cwd: o.cwd });
  const t = truncate((r.stdout + r.stderr).trim() || "(no matches)");
  process.stdout.write(t.text + `\n[vm:${cfg.name} exit:${r.code}]`);
  await audit({ tool: "search", vm: cfg.name, pattern, code: r.code });
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

async function runSetupUi(mode: "setup" | "manager") {
  if (!process.stdin.isTTY) {
    console.error("TUI needs an interactive terminal — use `vm add <name> --host H --user U` instead");
    process.exit(1);
  }
  try {
    // tui.ts is bundled; @opentui/core stays external (see build scripts) so
    // non-TUI commands never pay load cost and the slim bundle stays ~0.75M.
    const { runTui } = await import("./tui.ts");
    await runTui(mode);
  } catch (e) {
    const msg = (e as Error).message;
    if (/cannot find|not found|could not resolve/i.test(msg)) {
      console.error("TUI unavailable in this standalone binary — use `vm add <name> --host H --user U` flags or install from source");
    } else {
      console.error(msg);
    }
    process.exit(1);
  }
}

program.command("setup").description("Interactive VM setup wizard (OpenTUI)")
  .action(() => runSetupUi("setup"));

program.command("ui").description("Interactive VM manager: list, edit, test, activate (OpenTUI)")
  .action(() => runSetupUi("manager"));

await program.parseAsync(process.argv);
