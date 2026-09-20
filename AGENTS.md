# AGENTS.md — vm-connect-mcp workspace

## Purpose
CLI + MCP stdio server that lets coding agents run commands on a BYO Ubuntu VM over SSH. Single backend serves the `vm` CLI and all agent tools.

## Commands
- `bun test` — unit tests (`packages/cli/tests/`)
- `bun run check` — `tsc --noEmit` across CLI & Web
- `bun run build` — builds CLI (`dist/cli.js` ~0.74M + native ~60K) and Web (`apps/web`)
- `bun run build:cli` — builds only CLI bundle
- `bun run build:web` — builds Next.js showcase app
- `bun run build:binary` — 92M offline single file, keep for offline use only
- `bun run dev` — CLI help
- `bun run dev:web` — Next.js dev server (`apps/web`)
- `bun run mcp` — stdio MCP server (dev)

## Architecture
Monorepo (`workspaces: ["packages/*", "apps/*"]`):
- `packages/cli`: `cli.ts` (commander) · `mcp.ts` (7 stdio tools, slim schemas in exported `toolSchemas`) · `config.ts` (multi-VM store: `vms/<name>.json` + `active` pointer; `resolveVm`; `VM_CONNECT_DIR`/`VM_CONNECT_VM` env) · `ssh.ts` · `tmux.ts` · `safety.ts` (blocklist, 32k truncate, audit) · `vm_info.ts`
- `apps/web`: Next.js 16 (Turbopack, Tailwind CSS, App Router) static showcase frontend

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
