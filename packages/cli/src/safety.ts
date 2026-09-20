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

const SENSITIVE_PATHS: RegExp[] = [
  /(^|\/)\.ssh(\/|$)/,
  /\.pem$/,
  /\.key$/,
  /\/etc\/(shadow|gshadow|sudoers)/,
  /^\/proc\//,
  /^\/sys\//,
];

export function checkPath(p: string): string | null {
  if (!p || !p.trim()) return "blocked: empty path";
  if (p.includes("\0")) return "blocked: null byte in path";
  if (p.split("/").includes("..")) return "blocked: '..' traversal not allowed";
  const base = p.split("/").pop() ?? p;
  if (base === ".env" || base === ".envrc" || base.startsWith(".env.") || base.endsWith(".env")) {
    return "blocked: developer has not allowed .env file access — operation strictly refused";
  }
  for (const re of SENSITIVE_PATHS) {
    if (re.test(p)) return `blocked by path rule: ${re.source}`;
  }
  return null;
}

const ENV_FILE_EXEC_RES: RegExp[] = [
  /(^|[^\w.])\.env(\.[A-Za-z0-9_-]+)?(?=$|[^\w])/,
  /(^|[^\w])[\w-]+\.env(\.[A-Za-z0-9_-]+)?(?=$|[^\w])/,
  /\.envrc\b/,
];

const SSH_EXEC_RE = /\.ssh(?=$|[\s'"`;/|&)$])/;

const ENV_DUMP_RES: RegExp[] = [
  /(^|[\s;|&(`])env(\s*($|[;|&>]))/,
  /(^|[\s;|&(`])printenv(\s|$|[;|&>])/,
  /(^|[\s;|&(`])set(\s*($|[;|&>]))/,
];

export function checkSensitiveExec(command: string): string | null {
  for (const re of ENV_FILE_EXEC_RES) {
    if (re.test(command)) {
      return "blocked: developer has not allowed .env file access — operation strictly refused";
    }
  }
  if (SSH_EXEC_RE.test(command)) {
    return "blocked: developer has not allowed .ssh access — operation strictly refused";
  }
  for (const re of ENV_DUMP_RES) {
    if (re.test(command)) {
      return "blocked: developer has not allowed environment dumping — operation strictly refused";
    }
  }
  return null;
}

export function redactSecrets(text: string): string {
  return text
    .replace(/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g, "[REDACTED PRIVATE KEY]")
    .replace(
      /\b([A-Za-z0-9_]*(?:PASSWORD|PASSWD|SECRET|TOKEN|API[_-]?KEY|ACCESS[_-]?KEY|PRIVATE[_-]?KEY|CLIENT[_-]?SECRET|AUTH[_-]?TOKEN)[A-Za-z0-9_]*["']?\s*[:=]\s*)("[^"\n]*"|'[^'\n]*'|[^\s"'`;,}]+)/gi,
      "$1[REDACTED]",
    );
}

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
    await appendFile(AUDIT_PATH, redactSecrets(JSON.stringify({ ts: new Date().toISOString(), ...entry })) + "\n");
  } catch {}
}

export async function saveLog(id: string, text: string, opts?: { redact?: boolean }): Promise<string> {
  const { LOG_DIR } = paths();
  await mkdir(LOG_DIR, { recursive: true });
  const p = join(LOG_DIR, `${id}.log`);
  await Bun.write(p, opts?.redact ? redactSecrets(text) : text);
  return p;
}
