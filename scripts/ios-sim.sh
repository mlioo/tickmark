#!/usr/bin/env bash
# Build Tick Mark for the iOS Simulator with the project-local Node/pnpm +
# Ruby/CocoaPods sandboxes, then install/launch without Metro.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Project-local Node/pnpm sandbox (never Codex runtime, Homebrew, or system Node).
# shellcheck source=ensure-node-tools.sh
source "$ROOT/scripts/ensure-node-tools.sh"

# Project-local Ruby/CocoaPods sandbox (never system ~/.gem or Homebrew).
# shellcheck source=ensure-ios-tools.sh
source "$ROOT/scripts/ensure-ios-tools.sh"

# Keep sandboxed node + portable Ruby ahead of system paths.
export PATH="$NODE_PREFIX/bin:$GEM_HOME/bin:$RUBY_PREFIX/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export NODE_BINARY="${NODE_BINARY:-$NODE_PREFIX/bin/node}"

CONFIGURATION="${CONFIGURATION:-Release}"
DERIVED_DATA="${DERIVED_DATA:-/private/tmp/OpenTopoBuild}"
WORKSPACE="$ROOT/ios/TickMark.xcworkspace"
SCHEME="${SCHEME:-TickMark}"
BUNDLE_ID="${BUNDLE_ID:-jp.opentopo.companion}"

if [[ ! -x "$NODE_BINARY" ]]; then
  echo "error: sandboxed node not found at $NODE_BINARY" >&2
  exit 1
fi

if [[ ! -d "$WORKSPACE" ]]; then
  echo "error: $WORKSPACE missing — run ./scripts/pod-install.sh first" >&2
  exit 1
fi

SIMULATOR_ID="${SIMULATOR_ID:-}"
if [[ -z "$SIMULATOR_ID" ]]; then
  SIMULATOR_ID="$(xcrun simctl list devices booted | awk -F '[()]' '/iPhone/{print $2; exit}')"
fi
if [[ -z "$SIMULATOR_ID" ]]; then
  SIMULATOR_ID="3B64F44E-5717-4735-9183-0D0B57E655C3"
  echo "No booted simulator; using default $SIMULATOR_ID"
  xcrun simctl boot "$SIMULATOR_ID" 2>/dev/null || true
fi

cd "$ROOT"

echo "node: $(command -v node) ($(node --version))"
echo "pnpm: $(command -v pnpm) ($(pnpm --version))"
echo "simulator: $SIMULATOR_ID"
echo "configuration: $CONFIGURATION"

rm -rf "$DERIVED_DATA"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -sdk iphonesimulator \
  -destination "id=$SIMULATOR_ID" \
  -derivedDataPath "$DERIVED_DATA" \
  CODE_SIGNING_ALLOWED=NO \
  build

APP="$DERIVED_DATA/Build/Products/${CONFIGURATION}-iphonesimulator/TickMark.app"
if [[ ! -d "$APP" ]]; then
  echo "error: app not found at $APP" >&2
  exit 1
fi
if [[ ! -f "$APP/main.jsbundle" ]]; then
  echo "error: embedded main.jsbundle missing in $APP (use Release, not Debug-without-Metro)" >&2
  exit 1
fi

xcrun simctl terminate "$SIMULATOR_ID" "$BUNDLE_ID" 2>/dev/null || true
xcrun simctl install "$SIMULATOR_ID" "$APP"
xcrun simctl launch "$SIMULATOR_ID" "$BUNDLE_ID"
echo "Installed and launched $BUNDLE_ID from $APP"
