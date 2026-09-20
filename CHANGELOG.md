# CHANGELOG

## RECENT CHANGES

2026-09-20 — vm-connect-mcp scaffold: Bun TS CLI+MCP over SSH+tmux, 6 tools, blocklist+truncate+audit
2026-09-20 — vm-connect registered as MCP in opencode, pi (shared global), antigravity; vm/vm-connect symlinked globally
2026-09-20 — vm-connect added to zcode user config ~/.zcode/cli/config.json
2026-09-20 — slim build: JS bundle 788K replaces 92M binary, global vm via bun wrapper, build:binary kept
2026-09-20 — tests moved into tests/ (core.test.ts, config.test.ts), tsconfig include updated; 13 pass, tsc clean
2026-09-20 — friction fixes: bash -lic wrap + cwd on exec, vm_info 7th tool, 16 pass
2026-09-20 — ssh noise filter: -lic + strip job-control lines in sshExec, 19 pass
2026-09-20 — fixed vm wrappers: broken dist/vm-connect symlinks replaced with bun wrappers
2026-09-20 — README added: install, CLI+MCP reference, safety, troubleshooting
