#!/usr/bin/env bash
# Build OpenTopo for Android (Release, embedded JS, no Metro), then install/launch
# on an emulator using the project-local JDK/SDK sandboxes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

# Project-local Node/pnpm sandbox.
# shellcheck source=ensure-node-tools.sh
source "$ROOT/scripts/ensure-node-tools.sh"

# Project-local JDK + Android SDK sandbox.
# shellcheck source=ensure-android-tools.sh
source "$ROOT/scripts/ensure-android-tools.sh"

PACKAGE_ID="${PACKAGE_ID:-jp.opentopo.companion}"
AVD_NAME="${AVD_NAME:-${OPENTOPO_AVD_NAME:-OpenTopo_API36}}"
CONFIGURATION="${CONFIGURATION:-Release}"
# Apple Silicon emulator images are arm64; keep the APK lean for local runs.
ARCHS="${OPENTOPO_ANDROID_ARCHS:-arm64-v8a}"

if [[ ! -d "$ROOT/android" ]]; then
  echo "error: android/ missing — run: pnpm exec expo prebuild --platform android" >&2
  exit 1
fi

export PATH="$NODE_PREFIX/bin:$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
export NODE_BINARY="${NODE_BINARY:-$NODE_PREFIX/bin/node}"

wait_for_adb_device() {
  local tries=0
  until adb devices | awk 'NR>1 && $2=="device" {found=1} END{exit !found}'; do
    tries=$((tries + 1))
    if [[ "$tries" -gt 90 ]]; then
      echo "error: no adb device/emulator became ready" >&2
      exit 1
    fi
    sleep 2
  done
  # Wait until boot completed.
  tries=0
  until [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; do
    tries=$((tries + 1))
    if [[ "$tries" -gt 90 ]]; then
      echo "error: emulator boot timed out" >&2
      exit 1
    fi
    sleep 2
  done
}

if ! adb devices | awk 'NR>1 && $2=="device" {found=1} END{exit !found}'; then
  echo "No device connected; starting emulator @$AVD_NAME"
  if [[ ! -d "$ANDROID_AVD_HOME/${AVD_NAME}.avd" ]]; then
    echo "error: AVD '$AVD_NAME' not found under $ANDROID_AVD_HOME" >&2
    exit 1
  fi
  nohup emulator -avd "$AVD_NAME" -netdelay none -netspeed full >/tmp/opentopo-emulator.log 2>&1 &
  echo "emulator pid $! (log: /tmp/opentopo-emulator.log)"
fi

wait_for_adb_device

cd "$ROOT/android"

echo "node: $(command -v node) ($(node --version))"
echo "java: $JAVA_HOME"
echo "sdk: $ANDROID_HOME"
echo "avd/device ready; building ${CONFIGURATION} (${ARCHS})"

# React Native copies bundled images into generated drawables. Incremental copies
# leave old .jpeg/.png next to new .jpg files, and Android treats those as one resource.
rm -rf "$ROOT/android/app/build/generated/res/react"

GRADLE_TASK="assembleRelease"
if [[ "$CONFIGURATION" == "Debug" ]]; then
  GRADLE_TASK="assembleDebug"
fi

./gradlew "$GRADLE_TASK" \
  -PreactNativeArchitectures="$ARCHS" \
  --no-daemon

if [[ "$CONFIGURATION" == "Debug" ]]; then
  APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
else
  APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
fi

if [[ ! -f "$APK" ]]; then
  echo "error: APK not found at $APK" >&2
  exit 1
fi

# Release embeds the JS bundle; Debug does not (needs Metro) — match ios-sim policy.
# Expo/Hermes may use index.android.bundle or a hashed asset under assets/.
if [[ "$CONFIGURATION" != "Debug" ]]; then
  if ! unzip -l "$APK" | grep -Eiq 'assets/.*\.(bundle|hbc)$'; then
    echo "warning: could not confirm embedded JS bundle inside $APK" >&2
  fi
fi

adb install -r "$APK"
adb shell am force-stop "$PACKAGE_ID" >/dev/null 2>&1 || true
adb shell am start -a android.intent.action.MAIN -n "${PACKAGE_ID}/.MainActivity"
echo "Installed and launched $PACKAGE_ID from $APK"
