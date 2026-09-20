import { sshExec } from "./ssh.ts";
import type { VmConfig } from "./config.ts";

export type VmInfo = { os: string; user: string; hostname: string; ip: string; ram: string; disk: string };

const INFO_KEYS: (keyof VmInfo)[] = ["os", "user", "hostname", "ip", "ram", "disk"];
const SCRIPT = [
  "echo OS=$(uname -snrmo)",
  "echo USER=$(whoami)",
  "echo HOSTNAME=$(hostname)",
  "echo IP=$(hostname -I | awk '{print $1}')",
  "echo RAM=$(free -m | awk '/Mem:/{print $2\"MB\"}')",
  "echo DISK=$(df -h / | awk 'NR==2{print $2\" used \"$3\" (\"$5\")\"}')",
].join("; ");

export async function fetchVmInfo(cfg: VmConfig): Promise<VmInfo> {
  const r = await sshExec(cfg, SCRIPT);
  const info: Partial<VmInfo> = {};
  for (const line of r.stdout.split("\n")) {
    const m = line.match(/^(\w+)=(.*)$/);
    const k = m?.[1]?.toLowerCase();
    if (m && k && INFO_KEYS.includes(k as keyof VmInfo)) info[k as keyof VmInfo] = m[2];
  }
  if (!info.os || !info.user || !info.hostname || !info.ip || !info.ram || !info.disk) {
    throw new Error(`vm_info incomplete: ${JSON.stringify(info)}`);
  }
  return info as VmInfo;
}

export function formatVmInfo(cfgName: string, info: VmInfo): string {
  return [
    `[vm:${cfgName}]`,
    `os       ${info.os}`,
    `user     ${info.user}`,
    `hostname ${info.hostname}`,
    `ip       ${info.ip}`,
    `ram      ${info.ram}`,
    `disk     ${info.disk}`,
  ].join("\n");
}
