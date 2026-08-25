#!/usr/bin/env bash
# Ensure a project-local Node + pnpm sandbox under .tools/node.
# Never installs into system Node, Homebrew, or ~/.npm.
set -euo pipefail

# Resolve project root whether this file is executed or sourced (bash/zsh).
_opentopo_src="${BASH_SOURCE[0]:-$0}"
ROOT="$(cd "$(dirname "$_opentopo_src")/.." && pwd)"
unset _opentopo_src
TOOLS_ROOT="${OPENTOPO_NODE_TOOLS:-$ROOT/.tools/node}"
RUNTIME_ROOT="$TOOLS_ROOT/runtime"
NODE_VERSION="${NODE_VERSION:-24.14.0}"
PNPM_VERSION="${PNPM_VERSION:-11.16.0}"

arch="$(uname -m)"
case "$arch" in
  arm64) node_arch="arm64" ;;
  x86_64) node_arch="x64" ;;
  *)
    echo "error: unsupported architecture '$arch' (need arm64 or x86_64)" >&2
    exit 1
    ;;
esac

NODE_DIST="node-v${NODE_VERSION}-darwin-${node_arch}"
NODE_PREFIX="$RUNTIME_ROOT/$NODE_DIST"
NODE_URL="${NODE_URL:-https://nodejs.org/dist/v${NODE_VERSION}/${NODE_DIST}.tar.gz}"
COREPACK_HOME_DIR="$TOOLS_ROOT/corepack"

mkdir -p "$TOOLS_ROOT" "$RUNTIME_ROOT" "$COREPACK_HOME_DIR"

if [[ ! -x "$NODE_PREFIX/bin/node" ]]; then
  echo "Downloading Node $NODE_VERSION ($node_arch) into $RUNTIME_ROOT"
  tmp_tgz="$(mktemp /tmp/opentopo-node.XXXXXX.tar.gz)"
  curl -fL --retry 3 -o "$tmp_tgz" "$NODE_URL"
  tar -xzf "$tmp_tgz" -C "$RUNTIME_ROOT"
  rm -f "$tmp_tgz"
fi

NODE_BIN="$NODE_PREFIX/bin/node"
if [[ ! -x "$NODE_BIN" ]]; then
  echo "error: Node missing at $NODE_PREFIX" >&2
  exit 1
fi

export COREPACK_HOME="$COREPACK_HOME_DIR"
export PATH="$NODE_PREFIX/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export NODE_BINARY="$NODE_BIN"

# Corepack shims land next to node; keep npm-global prefix out of the picture.
if ! command -v pnpm >/dev/null 2>&1 || [[ "$(pnpm --version 2>/dev/null || true)" != "$PNPM_VERSION" ]]; then
  echo "Activating pnpm $PNPM_VERSION via Corepack (COREPACK_HOME=$COREPACK_HOME)"
  corepack enable
  corepack prepare "pnpm@${PNPM_VERSION}" --activate
fi

XCODE_ENV_LOCAL="$ROOT/ios/.xcode.env.local"
mkdir -p "$ROOT/ios"
cat >"$XCODE_ENV_LOCAL" <<EOF
export NODE_BINARY=$NODE_BIN
EOF

echo "node: $NODE_BIN ($("$NODE_BIN" --version))"
echo "pnpm: $(command -v pnpm) ($(pnpm --version))"
echo "COREPACK_HOME=$COREPACK_HOME"
echo "NODE_BINARY=$NODE_BINARY (wrote $XCODE_ENV_LOCAL)"
