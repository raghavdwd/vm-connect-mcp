import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { paths } from "./config.ts";

const BLOCKLIST: RegExp[] = [
  /\brm\s+-rf\s+\/(?:\s|$)/,
  /\bmkfs\b/,
  /\bdd\s+.*of=\/dev\//,
  /:\(\)\s*\{\s*:\|\:&\s*\}/,
  /\bshutdown\b/,
  /\breboot\b/,
  /\bhalt\b/,
];

export function shQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

export function checkBlocked(command: string): string | null {
  for (const re of BLOCKLIST) {
    if (re.test(command)) return `blocked by safety rule: ${re.source}`;
  }
  return null;
}

export const MAX_OUTPUT = 32_000;

export function truncate(output: string): { text: string; truncated: boolean } {
  if (output.length <= MAX_OUTPUT) return { text: output, truncated: false };
  return {
    text: output.slice(0, MAX_OUTPUT) + `\n...[truncated ${output.length - MAX_OUTPUT} chars]`,
    truncated: true,
  };
}

export async function audit(entry: Record<string, unknown>): Promise<void> {
  try {
    const { LOG_DIR, AUDIT_PATH } = paths();
    await mkdir(LOG_DIR, { recursive: true });
    await appendFile(AUDIT_PATH, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n");
  } catch {}
}

export async function saveLog(id: string, text: string): Promise<string> {
  const { LOG_DIR } = paths();
  await mkdir(LOG_DIR, { recursive: true });
  const p = join(LOG_DIR, `${id}.log`);
  await Bun.write(p, text);
  return p;
}
