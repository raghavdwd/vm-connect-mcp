#!/usr/bin/env bash
# Build a standalone vm-connect binary WITH the OpenTUI setup/manager TUI bundled.
# @opentui/core loads per-platform native packages via dynamic import branches;
# bun's bundler must resolve every branch, so we define process.platform/arch
# for the target to prune unreachable branches (see @opentui ship/deploy docs).
set -euo pipefail

cd "$(dirname "$0")/.."

TARGET="${TARGET:-}"
OUTFILE="${OUTFILE:-./dist/vm-connect-bin}"

if [ -z "$TARGET" ]; then
  case "$(uname -s):$(uname -m)" in
    Linux:x86_64) TARGET="bun-linux-x64" ;;
    Linux:aarch64|Linux:arm64) TARGET="bun-linux-arm64" ;;
    Darwin:arm64) TARGET="bun-darwin-arm64" ;;
    Darwin:x86_64) TARGET="bun-darwin-x64" ;;
    MINGW*:x86_64|MSYS*:x86_64) TARGET="bun-windows-x64" ;;
    *) echo "unsupported host: $(uname -s)/$(uname -m) — set TARGET explicitly" >&2; exit 1 ;;
  esac
fi

case "$TARGET" in
  bun-linux-*)   PLATFORM="linux";;
  bun-darwin-*)  PLATFORM="darwin";;
  bun-windows-*) PLATFORM="win32";;
  *) echo "unknown TARGET: $TARGET" >&2; exit 1 ;;
esac
case "$TARGET" in
  *-x64)   ARCH="x64";;
  *-arm64) ARCH="arm64";;
  *) echo "unknown arch in TARGET: $TARGET" >&2; exit 1 ;;
esac

mkdir -p dist
echo "compiling $TARGET (platform=$PLATFORM arch=$ARCH) → $OUTFILE"
bun build ./packages/cli/src/cli.ts --compile \
  --target="$TARGET" \
  --define "process.platform=\"$PLATFORM\"" \
  --define "process.arch=\"$ARCH\"" \
  --outfile "$OUTFILE"
echo "ok: $OUTFILE"
