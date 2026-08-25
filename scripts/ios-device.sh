#!/usr/bin/env bash
# Build Tick Mark for a physical iPhone with the project-local Node/pnpm +
# Ruby/CocoaPods sandboxes, then install/launch without Metro.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# ensure-ios-tools.sh points HOME at the Ruby sandbox; keep the real home for
# keychain signing, pairing records, and provisioning profiles.
ORIGINAL_HOME="${HOME}"

# Project-local Node/pnpm sandbox (never Codex runtime, Homebrew, or system Node).
# shellcheck source=ensure-node-tools.sh
source "$ROOT/scripts/ensure-node-tools.sh"

# Project-local Ruby/CocoaPods sandbox (never system ~/.gem or Homebrew).
# shellcheck source=ensure-ios-tools.sh
source "$ROOT/scripts/ensure-ios-tools.sh"

# Keep sandboxed node + portable Ruby ahead of system paths.
export PATH="$NODE_PREFIX/bin:$GEM_HOME/bin:$RUBY_PREFIX/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export NODE_BINARY="${NODE_BINARY:-$NODE_PREFIX/bin/node}"
# Signing / device pairing need the real user home, not the Ruby sandbox home.
export HOME="$ORIGINAL_HOME"

CONFIGURATION="${CONFIGURATION:-Release}"
DERIVED_DATA="${DERIVED_DATA:-/private/tmp/OpenTopoDeviceBuild}"
WORKSPACE="$ROOT/ios/TickMark.xcworkspace"
SCHEME="${SCHEME:-TickMark}"
BUNDLE_ID="${BUNDLE_ID:-jp.opentopo.companion}"
DEVELOPMENT_TEAM="${DEVELOPMENT_TEAM:-}"

if [[ ! -x "$NODE_BINARY" ]]; then
  echo "error: sandboxed node not found at $NODE_BINARY" >&2
  exit 1
fi

if [[ -z "$DEVELOPMENT_TEAM" ]]; then
  # OU on an Apple Development cert is the Team ID.
  DEVELOPMENT_TEAM="$(
    security find-certificate -c "Apple Development" -p 2>/dev/null \
      | openssl x509 -noout -subject 2>/dev/null \
      | sed -n 's/.*OU=\([^/]*\).*/\1/p' \
      | head -1
  )"
fi
if [[ -z "$DEVELOPMENT_TEAM" ]]; then
  echo "error: set DEVELOPMENT_TEAM (Apple Team ID) or install an Apple Development certificate" >&2
  exit 1
fi

DEVICE_ID="${DEVICE_ID:-}"
if [[ -z "$DEVICE_ID" ]]; then
  # Physical devices list an OS version before the UDID; Mac hosts do not.
  # Example: "Matty (26.5.2) (00008150-000C43983AE1401C)"
  DEVICE_ID="$(
    xcrun xctrace list devices 2>/dev/null \
      | sed -n 's/.*([0-9][0-9]*\.[0-9][^)]*) (\([0-9A-Fa-f-]\{25,\}\)).*/\1/p' \
      | head -1
  )"
fi
if [[ -z "$DEVICE_ID" ]]; then
  echo "error: no physical iOS device found. Unlock the phone, trust this Mac, and enable Developer Mode." >&2
  exit 1
fi

cd "$ROOT"

echo "node: $(command -v node) ($(node --version))"
echo "pnpm: $(command -v pnpm) ($(pnpm --version))"
echo "device: $DEVICE_ID"
echo "team: $DEVELOPMENT_TEAM"
echo "configuration: $CONFIGURATION"

rm -rf "$DERIVED_DATA"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -sdk iphoneos \
  -destination "id=$DEVICE_ID" \
  -derivedDataPath "$DERIVED_DATA" \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$DEVELOPMENT_TEAM" \
  CODE_SIGN_STYLE=Automatic \
  build

APP="$DERIVED_DATA/Build/Products/${CONFIGURATION}-iphoneos/TickMark.app"
if [[ ! -d "$APP" ]]; then
  echo "error: app not found at $APP" >&2
  exit 1
fi
if [[ ! -f "$APP/main.jsbundle" ]]; then
  echo "error: embedded main.jsbundle missing in $APP (use Release, not Debug-without-Metro)" >&2
  exit 1
fi

xcrun devicectl device install app --device "$DEVICE_ID" "$APP"
xcrun devicectl device process launch --device "$DEVICE_ID" "$BUNDLE_ID" || true
echo "Installed and launched $BUNDLE_ID from $APP on $DEVICE_ID"
