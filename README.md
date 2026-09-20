# vm-connect-mcp

CLI + MCP server that lets coding agents (and humans) run commands on a
bring-your-own Ubuntu VM over SSH. One backend serves the `vm` CLI and all
agent tools.

## Requirements

- [Bun](https://bun.sh) 1.x on the machine that runs the CLI / agent
- SSH access to an Ubuntu VM (key-based auth recommended)
- `tmux` installed on the VM (only needed for stateful sessions)

## Install

Linux / macOS:

```sh
curl -fsSL https://raw.githubusercontent.com/raghavdwd/vm-connect-mcp/main/scripts/install.sh | bash
```

Native Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/raghavdwd/vm-connect-mcp/main/scripts/install.ps1 | iex
```

The scripts auto-install Bun if missing, clone the repo (`~/vm-connect-mcp`),
`bun install` + `bun run build`, and create the `vm` / `vm-connect` commands.
Windows users on WSL2 or Git Bash can use `install.sh` instead. Useful flags:
`--dir PATH` (checkout location), `--bin-dir PATH` (where commands go),
`--skip-bun`.

Manual equivalent:

```sh
git clone https://github.com/raghavdwd/vm-connect-mcp.git
cd vm-connect-mcp
bun install
bun run build        # slim bundle -> dist/cli.js (~0.74 MB)
```

Expose the `vm` / `vm-connect` commands by creating wrappers in `~/.local/bin`
(make sure `~/.local/bin` is on your `PATH`):

```sh
printf '#!/bin/sh\nexec %s %s/dist/cli.js "$@"\n' \
  "$(command -v bun)" "$PWD" > ~/.local/bin/vm
cp ~/.local/bin/vm ~/.local/bin/vm-connect
chmod +x ~/.local/bin/vm ~/.local/bin/vm-connect
vm --help
```

> Re-run `bun run build` after every `git pull`. The wrappers point at
> `dist/cli.js`, so no wrapper changes are needed on rebuild.

## Quickstart

```sh
vm add default --host <HOST> --user ubuntu --key ~/.ssh/id_ed25519
vm list                        # '*' marks the active VM
vm info                        # OS, user, hostname, IP, RAM, disk
vm exec -- uname -a
vm exec --cwd /tmp -- pwd      # -> /tmp
```

Commands starting with a dash need `--` first: `vm exec -- -my-flag`.

## CLI reference

| Command | What it does |
|---|---|
| `vm add <name> --host H --user U [--port P] [--key PATH]` | Register a VM (first one becomes active) |
| `vm init --host H --user U ...` | Alias for `vm add default ...` |
| `vm use <name>` | Set the active VM |
| `vm list` | Show registered VMs, `*` marks active |
| `vm rm <name>` | Delete a registered VM |
| `vm info` | OS, user, hostname, IP, RAM, disk of the active VM |
| `vm exec [--cwd PATH] [--timeout MS] [--vm NAME] -- <cmd...>` | One-shot command |
| `vm session spawn <id> [cmd...]` | Detached tmux session on the VM |
| `vm session send <id> <input...>` | Send a line of input to a session |
| `vm session poll <id> [--lines N]` | Read recent output (`[alive: true/false]`) |
| `vm session kill <id>` | Kill a session (CLI-only, not exposed to agents) |
| `vm push <local> <remote>` | Upload a file |
| `vm pull <remote> <local>` | Download a file |
| `vm read <remote> [--offset N] [--lines N]` | Read remote text file, paged by lines |
| `vm edit <remote> --old S --new S [--replace-all]` | Exact-string edit, backup in logs |
| `vm search <pattern> [path] [--glob G] [--limit N]` | Ripgrep search on the VM |
| `vm ssh` | Interactive SSH into the active VM |
| `vm mcp` | Start the MCP stdio server (hidden; used by agent configs) |

Global flags: `--vm <name>` targets a VM without switching the active one,
`--cwd <path>` sets the remote working directory for `exec` / session commands
/ file ops.

## Multi-VM

VMs live in `~/.vm-connect/vms/<name>.json`, the active pointer in
`~/.vm-connect/active`. A legacy single-VM `config.json` auto-migrates to
`vms/default.json` (original kept as `config.json.bak`) on first load.

Two env overrides:

- `VM_CONNECT_DIR` — use a different store directory (default `~/.vm-connect`)
- `VM_CONNECT_VM` — target a VM for one invocation without `vm use`

Credentials live in `~/.vm-connect/vms/`. Never paste host IPs or key contents
into chat or docs.

## Agent (MCP) setup

### One-prompt setup (paste into any agent)

Copy-paste this into your coding agent. It installs, connects, self-registers,
verifies, and guides you further. Fill in your VM details or let the agent ask:

```text
Set up vm-connect-mcp on this machine so you can run commands on my Ubuntu
VM over SSH. Work end to end and guide me whenever you need input.

1. Install: check `vm --help`. If missing, install:
   Linux/macOS:
   curl -fsSL https://raw.githubusercontent.com/raghavdwd/vm-connect-mcp/main/scripts/install.sh | bash
   Windows PowerShell:
   irm https://raw.githubusercontent.com/raghavdwd/vm-connect-mcp/main/scripts/install.ps1 | iex
2. Connect: if I haven't given them, ASK me for VM host, SSH user, and
   private key path (never ask for key contents). Then run:
   vm add default --host <HOST> --user <USER> --key <KEY_PATH>
   (If the VM already exists: `vm list`, then `vm use <name>`.)
3. Verify: `vm info` and `vm exec -- uname -a` must succeed.
4. Self-register: add the MCP stdio server to YOUR OWN agent config
   (whichever agent you are — opencode, pi, Claude, Cursor, Antigravity,
   zcode): command `<VM_CMD>` (e.g. ~/.local/bin/vm), args `["mcp"]`.
   If you cannot edit your own config, print the exact JSON snippet for
   me to paste instead.
5. Confirm: list your MCP tools (expect vm_exec, vm_session_spawn/send/poll,
   vm_file_push/pull/read/edit, vm_search, vm_list, vm_info), call vm_info, summarize
   what you can now do, and tell me what to try next.
Rules: never print private key contents; keep host IPs out of docs;
refuse .env / .ssh reads and rm-rf-style destructive commands.
```

Prefer a UI? The showcase app builds this prompt for you with your values
filled in (see Agent Prompt Builder section).

Register the stdio server in your agent framework. Example for
`~/.config/opencode/opencode.jsonc`:

```json
"mcp": {
  "vm-connect": {
    "type": "local",
    "command": ["/home/USER/.local/bin/vm", "mcp"],
    "enabled": true
  }
}
```

### Tools (11)

| Tool | Description |
|---|---|
| `vm_exec` | One-shot command (`command`, `timeoutMs?`, `cwd?`) |
| `vm_session_spawn` | Persistent tmux session (`id`, `cmd?`) |
| `vm_session_send` | Send input (`id`, `input`) |
| `vm_session_poll` | Read output (`id`, `lines?`) |
| `vm_file_push` | Upload (`localPath`, `remotePath`) |
| `vm_file_pull` | Download (`remotePath`, `localPath`) |
| `vm_file_read` | Read remote text file (`remotePath`, `offset?`, `limit?`, `cwd?`) |
| `vm_file_edit` | Exact-string edit (`remotePath`, `oldString`, `newString`, `replaceAll?`, `cwd?`) |
| `vm_search` | Ripgrep search (`pattern`, `path?`, `glob?`, `limit?`, `cwd?`) |
| `vm_list` | List registered VMs, `*` marks active (no params) |
| `vm_info` | OS / user / hostname / IP / RAM / disk (no params) |

Every result is stamped `[vm:<name>]` so agents always know which VM answered.
`vm_exec` results append `[vm:<name> exit:<code>]`.

## Safety model

No approval gate — blocklist + audit only.

- **Blocklist** (`src/safety.ts`): `rm -rf /`, `mkfs`, `dd ... of=/dev/…`,
  fork bombs, `shutdown` / `reboot` / `halt`. Matches are refused before any
  SSH happens.
- **Path guardrails:** `read` / `edit` / `search` / `push` / `pull` refuse `..` traversal,
  `~/.ssh/`, `*.pem` / `*.key`, `/etc/shadow`-class paths, `/proc/` + `/sys/`,
  plus `.env` files (`.env`, `.env.local`, `*.env`, `.envrc`).
  Edits cap at 256 KB, reads at 512 KB, binaries refused.
- **Exec secret guard:** `exec` / `session spawn` refuse `.env` file access,
  `.ssh` access, and bare `env` / `printenv` / `set` dumps — refused with
  "developer has not allowed … operation strictly refused".
- **Audit redaction:** `audit.log` entries scrub `PASSWORD=` / `TOKEN=`-style
  values and private-key blocks (`[REDACTED]`).
- **Truncation:** command output is capped at 32k chars; overflow spills to a
  full log file whose path is returned with the result.
- **Audit:** every CLI and MCP action appends to `~/.vm-connect/audit.log`;
  full outputs land in `~/.vm-connect/logs/<id>.log`.

## How it works

- Every one-shot command is wrapped in a login shell (`bash -lic`) via a
  base64 payload, so `~/.profile` / NVM paths resolve exactly like an
  interactive login. Optional `cwd` prepends `cd '<dir>' &&`.
- Login shells on non-tty channels print `cannot set terminal process group` /
  `no job control in this shell` on stderr; `sshExec` strips those two lines
  centrally. Real stderr (warnings, errors) is preserved.
- Stateful work uses one tmux session per id; `send`/`poll` are separate short
  SSH connections, so many sequential calls are cheap. Prefer sessions over
  parallel `vm_exec` bursts — parallel bursts can hit the server's
  `MaxStartups` throttle and get connections refused (retry, don't panic).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `vm: command not found` | `~/.local/bin` not on `PATH`, or wrappers missing — recreate per Install |
| Wrappers are broken symlinks to `dist/vm-connect` | Old artifact name; replace with the bun wrappers from Install |
| Flags swallowed (`vm exec -x`) | Use `vm exec -- -x` |
| `no VM "x"` / `no active VM` | `vm list`, then `vm use <name>` |
| `tmux: command not found` on VM | `sudo apt install tmux` on the VM |
| Occasional refused connection under parallel load | `MaxStartups` throttle — serialize or use sessions |

## Binary distribution

`bun run build:binary` produces a ~92 MB self-contained offline binary
(`dist/vm-connect-bin`). For sharing with other users, publish it as a
**GitHub Release** asset (correct channel for binaries — versioned downloads,
checksums, no server needed). Vercel is not suitable: it hosts web
deployments, not downloadable release artifacts.

## Development

```sh
bun test        # unit tests (tests/)
bun run check   # tsc --noEmit
bun run build   # slim dist (never re-add --outfile/--banner: the ssh2 native
                # asset forces code-split and a shebang breaks `bun dist/cli.js`)
```

Conventions: compressed terse replies, grill (ask) before non-trivial tasks,
log changes under `## RECENT CHANGES` in `CHANGELOG.md`, verify with
`bun test` + `bun run check` + live `vm exec -- uname -a`.
