import type { VmConfig } from "./config.ts";
import { sshExec } from "./ssh.ts";

export function shQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

export async function sessionSpawn(cfg: VmConfig, id: string, cmd?: string) {
  const start = cmd ? shQuote(cmd) : "";
  // create detached tmux session; ignore error if exists
  const r = await sshExec(cfg, `tmux new-session -d -s ${shQuote(id)} ${start} 2>&1 || tmux new-session -d -s ${shQuote(id)} 2>&1; echo spawned`);
  return r;
}

// send keys + Enter to session pane
export async function sessionSend(cfg: VmConfig, id: string, input: string) {
  // write via printf to avoid quoting hell, then load into pane
  const b64 = Buffer.from(input, "utf8").toString("base64");
  const script = `echo ${b64} | base64 -d | tmux load-buffer - ; tmux paste-buffer -p -t ${shQuote(id)}; tmux send-keys -t ${shQuote(id)} Enter`;
  return sshExec(cfg, script);
}

export async function sessionPoll(cfg: VmConfig, id: string, lines = 200) {
  const r = await sshExec(cfg, `tmux capture-pane -p -t ${shQuote(id)} -S -${lines} 2>&1; echo "__EXIT__:$?"`);
  const alive = await sshExec(cfg, `tmux has-session -t ${shQuote(id)} 2>&1; echo "__ALIVE__:$?"`);
  return { output: r.stdout, alive: !/no server|can't find session|failed/i.test(alive.stdout) };
}

export async function sessionKill(cfg: VmConfig, id: string) {
  return sshExec(cfg, `tmux kill-session -t ${shQuote(id)} 2>&1; echo killed`);
}
