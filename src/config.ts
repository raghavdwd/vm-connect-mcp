import { homedir } from "node:os";
import { join } from "node:path";

export type VmConfig = {
  host: string;
  port?: number;
  user: string;
  keyPath?: string;
  password?: string;
};

const DIR = join(homedir(), ".vm-connect");
export const CONFIG_PATH = join(DIR, "config.json");
export const LOG_DIR = join(DIR, "logs");
export const AUDIT_PATH = join(DIR, "audit.log");

export async function loadConfig(overrides: Partial<VmConfig> = {}): Promise<VmConfig> {
  let file: Partial<VmConfig> = {};
  try {
    file = await Bun.file(CONFIG_PATH).json();
  } catch {}
  const cfg: VmConfig = {
    host: overrides.host ?? (file.host as string) ?? process.env.VM_HOST ?? "",
    port: overrides.port ?? file.port ?? Number(process.env.VM_PORT ?? 22),
    user: overrides.user ?? (file.user as string) ?? process.env.VM_USER ?? "",
    keyPath: overrides.keyPath ?? file.keyPath ?? process.env.VM_KEY_PATH,
    password: overrides.password ?? file.password ?? process.env.VM_PASSWORD,
  };
  if (!cfg.host) throw new Error(`missing host. set ${CONFIG_PATH} or --host / VM_HOST`);
  if (!cfg.user) throw new Error(`missing user. set ${CONFIG_PATH} or --user / VM_USER`);
  return cfg;
}

export async function saveConfig(cfg: VmConfig): Promise<void> {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(DIR, { recursive: true });
  await Bun.write(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

export function paths() {
  return { DIR, CONFIG_PATH, LOG_DIR, AUDIT_PATH };
}
