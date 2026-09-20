# AGENTS.md — vm-connect-mcp workspace

## Purpose
CLI + MCP stdio server that lets coding agents run commands on a BYO Ubuntu VM over SSH. Single backend serves the `vm` CLI and all agent tools.

## Commands
- `bun test` — unit tests (tests/core.test.ts, tests/config.test.ts)
- `bun run check` — `tsc --noEmit`
- `bun run build` — slim dist (`dist/cli.js` ~0.74M + native ~60K); **never** re-add `--outfile`/`--banner` (ssh2 native asset forces code-split; shebang breaks `bun dist/cli.js` runs)
- `bun run build:binary` — 92M offline single file, keep for offline use only
- `bun run dev` — `cli.ts --help`
- `bun run mcp` — stdio MCP server (dev)

## Architecture
`cli.ts` (commander: init/add/use/list/rm, exec, session spawn/send/poll/kill, push, pull, ssh, mcp) · `mcp.ts` (6 stdio tools, slim schemas in exported `toolSchemas`) · `config.ts` (multi-VM store: `vms/<name>.json` + `active` pointer; `resolveVm`; `VM_CONNECT_DIR`/`VM_CONNECT_VM` env) · `ssh.ts` · `tmux.ts` · `safety.ts` (blocklist, 32k truncate, audit)

## Multi-VM store (added 2026-09-20)
`~/.vm-connect/vms/<name>.json` + `active`; legacy `config.json` auto-migrates to `vms/default.json` + `.bak` on first load. `vm use <name>` flips active for CLI + MCP live (config is re-read per call). Audited `[vm:<name>]` stamps on MCP results. Agent MCP registrations (opencode, pi shared global, antigravity, zcode) unchanged.

## Gotchas
- `vm exec -- <cmd>` — dash flags need `--`
- `bun build` with `--outfile` fails; use `--outdir ./dist`; never re-add `--banner`
- `cli.ts` statically imports `mcp.ts` (dynamic import caused splitting)
- tmux must exist on VM; no approval gate — blocklist + audit only
- VM creds in `~/.vm-connect/config.json`/**vms/** — never paste host IP or key contents into chat/docs

## Sensitive areas — read first
`docs/superpowers/specs/2026-09-20-vm-connect-design.md` (v1) and `2026-09-20-vm-connect-multi-vm-design.md` before changing config/MCP surface/safety.

## Session conventions (persist)
Compressed terse replies; grill before non-trivial tasks via `AskUserQuestion`; update `CHANGELOG.md` under `## RECENT CHANGES`; verify via `bun test` + `bun run check` + live `vm exec -- uname -a`.
