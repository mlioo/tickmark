#!/usr/bin/env bash
# Run `pod install` using the project-local Node + Ruby/CocoaPods sandboxes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=ensure-node-tools.sh
source "$ROOT/scripts/ensure-node-tools.sh"
# shellcheck source=ensure-ios-tools.sh
source "$ROOT/scripts/ensure-ios-tools.sh"

# Keep sandboxed node + portable Ruby ahead of system paths.
export PATH="$NODE_PREFIX/bin:$GEM_HOME/bin:$RUBY_PREFIX/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export NODE_BINARY="${NODE_BINARY:-$NODE_PREFIX/bin/node}"
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

cd "$ROOT/ios"
echo "Running: pod install (sandboxed)"
pod install "$@"
