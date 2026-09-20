# CHANGELOG

## RECENT CHANGES

2026-09-20 — file tools: vm_file_read / vm_file_edit (exact-match + backup) + vm_search (ripgrep), path guardrails, CLI mirrors, 35 pass
2026-09-20 — secret guard: .env/.ssh blocked in exec+spawn+file tools, env/printenv/set dumps refused, audit+output-log redaction (backups exact), 45 pass
2026-09-20 — one-prompt agent setup: paste-in prompt in README + interactive Agent Prompt Builder in web app
2026-09-20 — vm_list agent tool: registered VMs + active mark over MCP (11 tools), 45 pass
2026-09-20 — OpenTUI vm setup/ui: full VM manager TUI (@opentui/core) with .pem key support, save/test/use/rm, bundled into release binaries via scripts/build-binary.sh
2026-09-20 — TUI key validation: any private key format accepted (ed25519/rsa/ecdsa), extension check fixed to filename-only so ~/.ssh/id_ed25519 no longer warns

2026-09-20 — vm-connect-mcp scaffold: Bun TS CLI+MCP over SSH+tmux, 6 tools, blocklist+truncate+audit
2026-09-20 — vm-connect registered as MCP in opencode, pi (shared global), antigravity; vm/vm-connect symlinked globally
2026-09-20 — vm-connect added to zcode user config ~/.zcode/cli/config.json
2026-09-20 — slim build: JS bundle 788K replaces 92M binary, global vm via bun wrapper, build:binary kept
2026-09-20 — tests moved into tests/ (core.test.ts, config.test.ts), tsconfig include updated; 13 pass, tsc clean
2026-09-20 — friction fixes: bash -lic wrap + cwd on exec, vm_info 7th tool, 16 pass
2026-09-20 — ssh noise filter: -lic + strip job-control lines in sshExec, 19 pass
2026-09-20 — fixed vm wrappers: broken dist/vm-connect symlinks replaced with bun wrappers
2026-09-20 — README added: install, CLI+MCP reference, safety, troubleshooting
2026-09-20 — install.sh + install.ps1: source-build installers, bun bootstrap, verified in sandbox
2026-09-20 — installers moved into scripts/, README URLs updated
2026-09-20 — monorepo refactor: packages/cli + apps/web (Next.js 16 App Router) initialized, bun workspaces configured, 19 tests pass, tsc clean
2026-09-20 — apps/web UI: minimalist Jet Black + Terminal Emerald showcase, Tabler icons, interactive 7-tool stdio terminal simulator, Raycast-style spec matrix, safety deck, and agent configurator
2026-09-20 — streamlined installers: install.sh & install.ps1 skip web dependencies, default build targets CLI bundle only (~740KB), zero Next.js overhead for end users
2026-09-20 — GitHub Actions release workflow: multi-OS matrix (Linux x64/arm64, macOS arm64/x64, Windows x64) compiles standalone binaries on tag push; install scripts fetch prebuilt binary directly
2026-09-20 — interactive installer prompt: install.sh & install.ps1 prompt user to choose between prebuilt binary (instant, no clone) and source build (--binary / --source flags supported)
