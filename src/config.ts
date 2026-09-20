import { readdir, rename } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type VmConfig = {
  name: string;
  host: string;
  port?: number;
  user: string;
  keyPath?: string;
  password?: string;
};

export const VM_NAME_RE = /^[A-Za-z0-9._-]+$/;

export function rootDir(): string {
  return process.env.VM_CONNECT_DIR ?? join(homedir(), ".vm-connect");
}

// resolved per call so `vm use` in another process is picked up immediately
export function paths() {
  const DIR = rootDir();
  return {
    DIR,
    VMS: join(DIR, "vms"),
    ACTIVE: join(DIR, "active"),
    CONFIG_PATH: join(DIR, "config.json"),
    LOG_DIR: join(DIR, "logs"),
    AUDIT_PATH: join(DIR, "audit.log"),
  };
}

function assertName(name: string): void {
  if (!VM_NAME_RE.test(name)) {
    throw new Error(`invalid VM name "${name}" — use letters, digits, dot, underscore, dash`);
  }
}

async function exists(p: string): Promise<boolean> {
  return await Bun.file(p).exists();
}

export async function listVms(): Promise<string[]> {
  const { VMS } = paths();
  try {
    const entries = await readdir(VMS);
    return entries.filter((e) => e.endsWith(".json")).map((e) => e.slice(0, -".json".length)).sort();
  } catch {
    return [];
  }
}

export async function getActive(): Promise<string | null> {
  const { ACTIVE } = paths();
  if (!(await exists(ACTIVE))) return null;
  const name = (await Bun.file(ACTIVE).text()).trim();
  return name || null;
}

export async function setActive(name: string | null): Promise<void> {
  const { DIR, ACTIVE } = paths();
  if (name === null) {
    const { unlink } = await import("node:fs/promises");
    try {
      await unlink(ACTIVE);
    } catch {}
    return;
  }
  const { mkdir } = await import("node:fs/promises");
  await mkdir(DIR, { recursive: true });
  await Bun.write(ACTIVE, name + "\n");
}

async function availableOrEmptyError(): Promise<Error> {
  const have = await listVms();
  return have.length
    ? new Error(`no active VM — run: vm use <${have.join("|")}>`)
    : new Error("no VMs configured — run: vm add <name> --host H --user U");
}

// v1 stored a single flat config.json; move it to vms/default.json once
export async function migrateLegacy(): Promise<boolean> {
  const p = paths();
  if ((await listVms()).length > 0 || (await getActive()) !== null) return false;
  if (!(await exists(p.CONFIG_PATH))) return false;
  let file: Partial<VmConfig>;
  try {
    file = await Bun.file(p.CONFIG_PATH).json();
  } catch {
    return false;
  }
  if (!file.host || !file.user) return false;
  await writeVm("default", { host: file.host, user: file.user, port: file.port, keyPath: file.keyPath, password: file.password });
  await setActive("default");
  await rename(p.CONFIG_PATH, p.CONFIG_PATH + ".bak");
  return true;
}

export async function readVm(name: string): Promise<VmConfig> {
  assertName(name);
  const file = join(paths().VMS, `${name}.json`);
  if (!(await exists(file))) {
    const have = await listVms();
    throw new Error(have.length ? `no VM "${name}" — available: ${have.join(", ")}` : `no VM "${name}" — none configured`);
  }
  const cfg = (await Bun.file(file).json()) as Omit<VmConfig, "name">;
  return { ...cfg, name };
}

export async function writeVm(name: string, cfg: Omit<VmConfig, "name">): Promise<void> {
  assertName(name);
  const { mkdir } = await import("node:fs/promises");
  await mkdir(paths().VMS, { recursive: true });
  await Bun.write(join(paths().VMS, `${name}.json`), JSON.stringify(cfg, null, 2) + "\n");
}

export async function addVm(name: string, cfg: Omit<VmConfig, "name">): Promise<boolean> {
  await writeVm(name, cfg);
  if ((await getActive()) === null) {
    await setActive(name);
    return true;
  }
  return false;
}

export async function rmVm(name: string): Promise<boolean> {
  await readVm(name); // validates existence and name
  const { unlink } = await import("node:fs/promises");
  await unlink(join(paths().VMS, `${name}.json`));
  if ((await getActive()) === name) {
    await setActive(null);
    return true;
  }
  return false;
}

export async function resolveVm(name?: string): Promise<VmConfig> {
  await migrateLegacy();
  const selected = name ?? process.env.VM_CONNECT_VM ?? (await getActive());
  if (!selected) throw await availableOrEmptyError();
  return readVm(selected);
}
