import { shQuote } from "./safety.ts";

export const MAX_READ_BYTES = 512 * 1024;
export const MAX_EDIT_BYTES = 256 * 1024;

export function assertTextBuffer(buf: Buffer): void {
  if (buf.includes(0)) throw new Error("binary file detected — read/edit refused");
}

export function resolveRemote(remotePath: string, cwd?: string): string {
  if (remotePath.startsWith("/") || remotePath.startsWith("~")) return remotePath;
  if (!cwd) return remotePath;
  return cwd.replace(/\/+$/, "") + "/" + remotePath.replace(/^\/+/, "");
}

export function sliceText(
  content: string,
  offset = 1,
  limit = 200,
): { text: string; total: number; start: number; end: number } {
  const lines = content.split("\n");
  const total = lines.length;
  const start = Math.max(1, offset);
  const end = Math.min(total, start + Math.max(1, limit) - 1);
  return { text: lines.slice(start - 1, end).join("\n"), total, start, end };
}

export function applyEdit(
  content: string,
  oldString: string,
  newString: string,
  replaceAll = false,
): { text: string; count: number } {
  if (!oldString) throw new Error("oldString must not be empty");
  const count = content.split(oldString).length - 1;
  if (count === 0) throw new Error("oldString not found in file");
  if (count > 1 && !replaceAll) {
    throw new Error(`oldString matches ${count} times — pass replaceAll to replace every occurrence`);
  }
  const text = replaceAll ? content.split(oldString).join(newString) : content.replace(oldString, newString);
  return { text, count: replaceAll ? count : 1 };
}

export function buildRgCommand(
  pattern: string,
  opts?: { path?: string; glob?: string | string[]; limit?: number },
): string {
  if (!pattern) throw new Error("pattern must not be empty");
  const parts = ["rg", "--no-heading", "--line-number", "--color", "never"];
  const limit = opts?.limit ?? 100;
  parts.push("-m", String(Math.max(1, limit)));
  const globs = opts?.glob === undefined ? [] : Array.isArray(opts.glob) ? opts.glob : [opts.glob];
  for (const g of globs) parts.push("--glob", shQuote(g));
  parts.push("-e", shQuote(pattern), "--", shQuote(opts?.path ?? "."));
  return parts.join(" ");
}
