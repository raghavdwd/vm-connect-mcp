import { homedir } from "node:os";
import { basename } from "node:path";
import { VM_NAME_RE } from "./config.ts";

export type VmFormFields = {
  name: string;
  host: string;
  user: string;
  port: string;
  keyPath: string;
  password: string;
};

export type ValidatedVmForm = {
  name: string;
  host: string;
  user: string;
  port?: number;
  keyPath?: string;
  password?: string;
  warnings: string[];
};

/** Expand leading ~ to the home directory; trim whitespace. */
export function expandPath(p: string): string {
  const t = p.trim();
  if (t === "~") return homedir();
  if (t.startsWith("~/")) return homedir() + t.slice(1);
  return t;
}

/** Empty string → undefined (default 22). Throws on invalid. */
export function parsePortField(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  if (!/^\d+$/.test(t)) throw new Error(`port must be a number 1-65535 (got "${raw}")`);
  const n = Number(t);
  if (n < 1 || n > 65535) throw new Error(`port must be 1-65535 (got "${raw}")`);
  return n;
}

/**
 * Pure validation for the TUI form. Returns normalized values plus
 * non-blocking warnings (e.g. key path extension, missing file is
 * checked async in the TUI so tests stay fs-free).
 */
export function validateVmFields(f: VmFormFields): { ok: boolean; errors: string[]; value: ValidatedVmForm } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const name = f.name.trim();
  const host = f.host.trim();
  const user = f.user.trim();

  if (!name) errors.push("name is required");
  else if (!VM_NAME_RE.test(name)) errors.push(`invalid name "${name}" — letters, digits, dot, underscore, dash`);

  if (!host) errors.push("host is required");
  else if (/\s/.test(host)) errors.push("host must not contain spaces");

  if (!user) errors.push("user is required");
  else if (/\s/.test(user)) errors.push("user must not contain spaces");

  let port: number | undefined;
  try {
    port = parsePortField(f.port);
  } catch (e) {
    errors.push((e as Error).message);
  }

  let keyPath: string | undefined;
  const keyRaw = f.keyPath.trim();
  if (keyRaw) {
    keyPath = expandPath(keyRaw);
    // .pem-first hint: any private key format works (ed25519, rsa, ecdsa —
    // ssh2 reads raw key bytes, format-agnostic). Warn only on an unusual
    // *filename* extension; extensionless keys like id_ed25519 are normal.
    const base = basename(keyPath);
    if (base.includes(".") && !/\.(pem|key|ppk|openssh|ed25519|rsa)$/i.test(base)) {
      warnings.push(`key "${keyRaw}" has an unusual extension — .pem (or extensionless) expected`);
    }
    if (keyPath.includes(" ")) warnings.push("key path contains spaces — quoted automatically on use");
  }

  const password = f.password ? f.password : undefined;

  return {
    ok: errors.length === 0,
    errors,
    value: { name, host, user, port, keyPath, password, warnings },
  };
}
