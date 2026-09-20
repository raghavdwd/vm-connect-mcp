import { readFile } from "node:fs/promises";
import { Client } from "ssh2";
import type { VmConfig } from "./config.ts";

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

export async function sshExec(cfg: VmConfig, command: string, timeoutMs = 60_000): Promise<ExecResult> {
  const client = await connect(cfg);
  try {
    return await new Promise<ExecResult>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
      client.exec(command, (err, channel) => {
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
          resolve({ code: code ?? 0, stdout, stderr });
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
