import { readFile } from "node:fs/promises";
import { Client } from "ssh2";
import type { VmConfig } from "./config.ts";
import { shQuote } from "./safety.ts";
import { MAX_EDIT_BYTES, MAX_READ_BYTES, assertTextBuffer, buildRgCommand } from "./files.ts";

export type ExecResult = { code: number; stdout: string; stderr: string };

function connect(cfg: VmConfig): Promise<Client> {
  return new Promise(async (resolve, reject) => {
    const client = new Client();
    client.once("ready", () => resolve(client)).once("error", reject);
    let privateKey: Buffer | undefined;
    if (cfg.keyPath) {
      try {
        privateKey = await readFile(cfg.keyPath);
      } catch (e) {
        reject(e);
        return;
      }
    }
    client.connect({
      host: cfg.host,
      port: cfg.port ?? 22,
      username: cfg.user,
      privateKey,
      password: cfg.password,
    });
  });
}

const NOISE_PATTERNS = [/cannot set terminal process group.*/, /no job control in this shell.*/];

export function filterNoise(stderr: string): string {
  return stderr
    .split("\n")
    .filter((line) => !NOISE_PATTERNS.some((re) => re.test(line)))
    .join("\n");
}

export function wrapCommand(command: string, cwd?: string): string {
  const inner = cwd ? `cd ${shQuote(cwd)} && ${command}` : command;
  const b64 = Buffer.from(inner).toString("base64");
  return `bash -lic 'eval "$(base64 -d <<< "${b64}")"'`;
}

export async function sshExec(cfg: VmConfig, command: string, timeoutMs = 60_000, opts?: { cwd?: string }): Promise<ExecResult> {
  const client = await connect(cfg);
  try {
    return await new Promise<ExecResult>((resolve, reject) => {
      const cmd = wrapCommand(command, opts?.cwd);
      const timer = setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
      client.exec(cmd, (err, channel) => {
        if (err) {
          clearTimeout(timer);
          reject(err);
          return;
        }
        let stdout = "";
        let stderr = "";
        channel.on("data", (d: Buffer) => (stdout += d.toString()));
        channel.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
        channel.on("close", (code: number) => {
          clearTimeout(timer);
          resolve({ code: code ?? 0, stdout, stderr: filterNoise(stderr) });
        });
      });
    });
  } finally {
    client.end();
  }
}

export async function sshPush(cfg: VmConfig, localPath: string, remotePath: string): Promise<void> {
  const client = await connect(cfg);
  try {
    const sftp = await new Promise<any>((resolve, reject) =>
      client.sftp((err, s) => (err ? reject(err) : resolve(s))),
    );
    const data = await Bun.file(localPath).arrayBuffer();
    await new Promise<void>((resolve, reject) =>
      sftp.writeFile(remotePath, Buffer.from(data), (e: Error | null) => (e ? reject(e) : resolve())),
    );
    sftp.end();
  } finally {
    client.end();
  }
}

export async function sshPull(cfg: VmConfig, remotePath: string, localPath: string): Promise<void> {
  const client = await connect(cfg);
  try {
    const sftp = await new Promise<any>((resolve, reject) =>
      client.sftp((err, s) => (err ? reject(err) : resolve(s))),
    );
    const buf = await new Promise<Buffer>((resolve, reject) =>
      sftp.readFile(remotePath, (e: Error | null, b: Buffer) => (e ? reject(e) : resolve(b))),
    );
    await Bun.write(localPath, buf);
    sftp.end();
  } finally {
    client.end();
  }
}

export async function sshReadText(cfg: VmConfig, remotePath: string): Promise<string> {
  const client = await connect(cfg);
  try {
    const sftp = await new Promise<any>((resolve, reject) =>
      client.sftp((err, s) => (err ? reject(err) : resolve(s))),
    );
    const buf = await new Promise<Buffer>((resolve, reject) =>
      sftp.readFile(remotePath, (e: Error | null, b: Buffer) => (e ? reject(e) : resolve(b))),
    );
    sftp.end();
    if (buf.length > MAX_READ_BYTES) throw new Error(`file too large (${buf.length} bytes, cap ${MAX_READ_BYTES}) — pull it instead`);
    assertTextBuffer(buf);
    return buf.toString("utf8");
  } finally {
    client.end();
  }
}

export async function sshWriteText(cfg: VmConfig, remotePath: string, text: string): Promise<void> {
  const buf = Buffer.from(text, "utf8");
  if (buf.length > MAX_EDIT_BYTES) throw new Error(`write too large (${buf.length} bytes, cap ${MAX_EDIT_BYTES}) — push it instead`);
  const client = await connect(cfg);
  try {
    const sftp = await new Promise<any>((resolve, reject) =>
      client.sftp((err, s) => (err ? reject(err) : resolve(s))),
    );
    await new Promise<void>((resolve, reject) =>
      sftp.writeFile(remotePath, buf, (e: Error | null) => (e ? reject(e) : resolve())),
    );
    sftp.end();
  } finally {
    client.end();
  }
}

export async function sshSearch(
  cfg: VmConfig,
  pattern: string,
  opts?: { path?: string; glob?: string | string[]; limit?: number; cwd?: string },
): Promise<ExecResult> {
  const r = await sshExec(cfg, buildRgCommand(pattern, opts), 60_000, { cwd: opts?.cwd });
  if (/command not found|unknown command/i.test(r.stderr) && /rg/.test(r.stderr + r.stdout)) {
    throw new Error("ripgrep (rg) not installed on VM — run: sudo apt install ripgrep");
  }
  return r;
}
