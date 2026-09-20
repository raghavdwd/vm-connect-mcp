#!/usr/bin/env bash
# vm-connect-mcp installer — Linux and macOS.
# Windows: run inside WSL2, or under Git Bash (see install.ps1 for native Windows).
#
# Usage:
#   ./install.sh [--repo URL] [--dir PATH] [--bin-dir PATH] [--skip-bun]
# Env overrides: REPO_URL, INSTALL_DIR, BIN_DIR, SKIP_BUN=1.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/raghavdwd/vm-connect-mcp.git}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/vm-connect-mcp}"
BIN_DIR="${BIN_DIR:-$HOME/.local/bin}"
SKIP_BUN="${SKIP_BUN:-0}"
DIR_GIVEN=0

usage() {
  sed -n '2,7p' "$0"
  echo "Options: --repo URL --dir PATH --bin-dir PATH --skip-bun --help"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --repo) REPO_URL="$2"; shift 2 ;;
    --dir) INSTALL_DIR="$2"; DIR_GIVEN=1; shift 2 ;;
    --bin-dir) BIN_DIR="$2"; shift 2 ;;
    --skip-bun) SKIP_BUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown flag: $1" >&2; usage >&2; exit 1 ;;
  esac
done

case "$(uname -s)" in
  Linux|Darwin) ;;
  MINGW*|MSYS*|CYGWIN*) echo "note: Git Bash detected — continuing; WSL2 recommended on Windows." ;;
  *) echo "warning: untested OS ($(uname -s)) — continuing anyway." ;;
esac

need() { command -v "$1" >/dev/null 2>&1 || { echo "missing: $1 ($2)" >&2; exit 1; }; }

try_download_binary() {
  local os="$(uname -s)"
  local arch="$(uname -m)"
  local bin_name=""

  case "$os" in
    Linux)
      case "$arch" in
        x86_64) bin_name="vm-connect-linux-x64" ;;
        aarch64|arm64) bin_name="vm-connect-linux-arm64" ;;
      esac
      ;;
    Darwin)
      case "$arch" in
        arm64) bin_name="vm-connect-darwin-arm64" ;;
        x86_64) bin_name="vm-connect-darwin-x64" ;;
      esac
      ;;
  esac

  [ -z "$bin_name" ] && return 1

  command -v curl >/dev/null 2>&1 || return 1
  local url="https://github.com/raghavdwd/vm-connect-mcp/releases/latest/download/$bin_name"
  echo "checking prebuilt standalone binary ($bin_name)..."
  mkdir -p "$BIN_DIR"

  if curl -fsSL -L "$url" -o "$BIN_DIR/vm" 2>/dev/null && [ -s "$BIN_DIR/vm" ]; then
    chmod +x "$BIN_DIR/vm"
    ln -sf "$BIN_DIR/vm" "$BIN_DIR/vm-connect" 2>/dev/null || cp "$BIN_DIR/vm" "$BIN_DIR/vm-connect"
    echo "installed prebuilt binary into $BIN_DIR/vm"
    return 0
  fi
  rm -f "$BIN_DIR/vm" 2>/dev/null || true
  return 1
}

# If not running from existing checkout, try downloading prebuilt binary first
if [ "$DIR_GIVEN" -eq 0 ] && [ ! -f ./packages/cli/src/cli.ts ] && [ ! -f ./src/cli.ts ]; then
  if try_download_binary; then
    case ":$PATH:" in
      *":$BIN_DIR:"*) ;;
      *) echo "warning: $BIN_DIR not on PATH — add: export PATH=\"$BIN_DIR:\$PATH\"" >&2 ;;
    esac
    "$BIN_DIR/vm" --help >/dev/null
    echo "installed. next: vm add default --host <HOST> --user ubuntu --key ~/.ssh/id_ed25519"
    exit 0
  fi
  echo "prebuilt binary not yet published; falling back to lean source build..."
fi

need git "install git first: https://git-scm.com"

if [ "$SKIP_BUN" != 1 ] && ! command -v bun >/dev/null 2>&1; then
  need curl "install curl first, or install Bun manually: https://bun.sh"
  echo "installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi
need bun "install Bun: https://bun.sh (or rerun without --skip-bun)"
BUN_BIN="$(command -v bun)"

# Run in place when invoked from a checkout.
if [ "$DIR_GIVEN" -eq 0 ] && ([ -f ./packages/cli/src/cli.ts ] || [ -f ./src/cli.ts ]) && [ -f ./package.json ]; then
  INSTALL_DIR="$PWD"
fi

if [ -f "$INSTALL_DIR/packages/cli/src/cli.ts" ] || [ -f "$INSTALL_DIR/src/cli.ts" ]; then
  echo "using existing checkout: $INSTALL_DIR"
elif [ -e "$INSTALL_DIR" ]; then
  echo "error: $INSTALL_DIR exists but is not a vm-connect-mcp checkout" >&2
  exit 1
else
  echo "cloning CLI into $INSTALL_DIR (skipping web app)..."
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
  rm -rf "$INSTALL_DIR/apps"
fi

cd "$INSTALL_DIR"
# Only install and build CLI dependencies (zero Next.js / React / web dependencies)
bun install
bun run build:cli

mkdir -p "$BIN_DIR"
for name in vm vm-connect; do
  printf '#!/bin/sh\nexec %s %s/dist/cli.js "$@"\n' "$BUN_BIN" "$INSTALL_DIR" > "$BIN_DIR/$name"
  chmod +x "$BIN_DIR/$name"
done

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo "warning: $BIN_DIR not on PATH — add: export PATH=\"$BIN_DIR:\$PATH\"" >&2 ;;
esac

"$BIN_DIR/vm" --help >/dev/null
echo "installed. next: vm add default --host <HOST> --user ubuntu --key ~/.ssh/id_ed25519"
