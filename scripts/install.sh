#!/usr/bin/env bash
# vm-connect-mcp installer — Linux and macOS.
# Windows: run inside WSL2, or under Git Bash (see install.ps1 for native Windows).
#
# Usage:
#   ./install.sh [--binary] [--source] [--repo URL] [--dir PATH] [--bin-dir PATH] [--skip-bun]
# Env overrides: REPO_URL, INSTALL_DIR, BIN_DIR, SKIP_BUN=1, INSTALL_MODE=binary|source.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/raghavdwd/vm-connect-mcp.git}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/vm-connect-mcp}"
BIN_DIR="${BIN_DIR:-$HOME/.local/bin}"
SKIP_BUN="${SKIP_BUN:-0}"
INSTALL_MODE="${INSTALL_MODE:-}"
DIR_GIVEN=0

usage() {
  sed -n '2,7p' "$0"
  echo "Options: --binary --source --repo URL --dir PATH --bin-dir PATH --skip-bun --help"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --binary) INSTALL_MODE="binary"; shift ;;
    --source) INSTALL_MODE="source"; shift ;;
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

  if [ -z "$bin_name" ]; then
    echo "warning: unsupported OS/architecture for prebuilt binary ($os $arch)" >&2
    return 1
  fi

  command -v curl >/dev/null 2>&1 || return 1
  local url="https://github.com/raghavdwd/vm-connect-mcp/releases/latest/download/$bin_name"
  echo "downloading prebuilt binary: $bin_name..."
  mkdir -p "$BIN_DIR"

  if curl -fsSL -L "$url" -o "$BIN_DIR/vm" 2>/dev/null && [ -s "$BIN_DIR/vm" ]; then
    chmod +x "$BIN_DIR/vm"
    ln -sf "$BIN_DIR/vm" "$BIN_DIR/vm-connect" 2>/dev/null || cp "$BIN_DIR/vm" "$BIN_DIR/vm-connect"
    return 0
  fi
  rm -f "$BIN_DIR/vm" 2>/dev/null || true
  return 1
}

# Run in place when invoked from a checkout
if [ "$DIR_GIVEN" -eq 0 ] && ([ -f ./packages/cli/src/cli.ts ] || [ -f ./src/cli.ts ]) && [ -f ./package.json ]; then
  INSTALL_DIR="$PWD"
  INSTALL_MODE="source"
fi

# Prompt for installation method if not specified
if [ -z "$INSTALL_MODE" ]; then
  if [ -e /dev/tty ] && [ -r /dev/tty ]; then
    echo "" >/dev/tty
    echo "========================================" >/dev/tty
    echo "  vm-connect-mcp installation" >/dev/tty
    echo "========================================" >/dev/tty
    echo "Choose installation method:" >/dev/tty
    echo "  1) Prebuilt binary [Recommended] (instant, zero dependencies, no git/bun)" >/dev/tty
    echo "  2) Build from source (requires Git & Bun, builds lean CLI)" >/dev/tty
    printf "Enter choice [1-2] (default: 1): " >/dev/tty
    read -r USER_CHOICE < /dev/tty || USER_CHOICE="1"
    case "$USER_CHOICE" in
      2|source) INSTALL_MODE="source" ;;
      *) INSTALL_MODE="binary" ;;
    esac
    echo "" >/dev/tty
  else
    INSTALL_MODE="binary"
  fi
fi

# Binary installation route
if [ "$INSTALL_MODE" = "binary" ]; then
  echo "installing via prebuilt binary..."
  if try_download_binary; then
    case ":$PATH:" in
      *":$BIN_DIR:"*) ;;
      *) echo "warning: $BIN_DIR not on PATH — add: export PATH=\"$BIN_DIR:\$PATH\"" >&2 ;;
    esac
    "$BIN_DIR/vm" --help >/dev/null
    echo "installed successfully to $BIN_DIR/vm."
    echo "next: vm add default --host <HOST> --user ubuntu --key ~/.ssh/id_ed25519"
    exit 0
  else
    echo "prebuilt binary download failed (release asset not found or network error)." >&2
    if [ -e /dev/tty ] && [ -r /dev/tty ]; then
      printf "Would you like to build from source instead? [y/N]: " >/dev/tty
      read -r FALLBACK_CHOICE < /dev/tty || FALLBACK_CHOICE="n"
      case "$FALLBACK_CHOICE" in
        y*|Y*) ;;
        *) echo "aborted."; exit 1 ;;
      esac
    else
      exit 1
    fi
  fi
fi

# Source build route
echo "building from source..."
need git "install git first: https://git-scm.com"

if [ "$SKIP_BUN" != 1 ] && ! command -v bun >/dev/null 2>&1; then
  need curl "install curl first, or install Bun manually: https://bun.sh"
  echo "installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi
need bun "install Bun: https://bun.sh (or rerun without --skip-bun)"
BUN_BIN="$(command -v bun)"

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
echo "installed successfully from source."
echo "next: vm add default --host <HOST> --user ubuntu --key ~/.ssh/id_ed25519"
