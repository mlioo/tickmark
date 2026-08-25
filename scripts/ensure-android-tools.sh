#!/usr/bin/env bash
# Ensure a project-local JDK + Android SDK sandbox under .tools/android.
# Never installs into system paths or Homebrew unless OPENTOPO_ANDROID_USE_SYSTEM=1
# and ANDROID_HOME already points at a usable SDK.
set -euo pipefail

# Resolve project root whether this file is executed or sourced (bash/zsh).
_opentopo_src="${BASH_SOURCE[0]:-$0}"
ROOT="$(cd "$(dirname "$_opentopo_src")/.." && pwd)"
unset _opentopo_src

TOOLS_ROOT="${OPENTOPO_ANDROID_TOOLS:-$ROOT/.tools/android}"
SDK_ROOT="$TOOLS_ROOT/sdk"
JDK_ROOT="$TOOLS_ROOT/jdk"
AVD_HOME="$TOOLS_ROOT/avd"
DOWNLOADS="$TOOLS_ROOT/downloads"

# Pin toolchain versions (RN 0.86 / Expo 57 → compileSdk 36).
JDK_MAJOR="${OPENTOPO_JDK_MAJOR:-17}"
CMDLINE_TOOLS_VERSION="${OPENTOPO_CMDLINE_TOOLS_VERSION:-13114758}"
ANDROID_PLATFORM="${OPENTOPO_ANDROID_PLATFORM:-android-36}"
ANDROID_BUILD_TOOLS="${OPENTOPO_ANDROID_BUILD_TOOLS:-36.0.0}"
ANDROID_SYSTEM_IMAGE="${OPENTOPO_ANDROID_SYSTEM_IMAGE:-system-images;android-36;google_apis;arm64-v8a}"
DEFAULT_AVD_NAME="${OPENTOPO_AVD_NAME:-OpenTopo_API36}"

arch="$(uname -m)"
case "$arch" in
  arm64) jdk_arch="aarch64" ;;
  x86_64) jdk_arch="x64" ;;
  *)
    echo "error: unsupported architecture '$arch' (need arm64 or x86_64)" >&2
    exit 1
    ;;
esac

mkdir -p "$TOOLS_ROOT" "$SDK_ROOT" "$JDK_ROOT" "$AVD_HOME" "$DOWNLOADS"

use_system="${OPENTOPO_ANDROID_USE_SYSTEM:-0}"
if [[ "$use_system" == "1" && -n "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" ]]; then
  SDK_ROOT="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
  echo "Using system Android SDK at $SDK_ROOT (OPENTOPO_ANDROID_USE_SYSTEM=1)"
fi

# --- JDK (Temurin) ---
resolve_java_home() {
  if [[ "$use_system" == "1" && -n "${JAVA_HOME:-}" && -x "${JAVA_HOME}/bin/java" ]]; then
    echo "$JAVA_HOME"
    return
  fi
  local found
  found="$(find "$JDK_ROOT" -maxdepth 6 -type f -path '*/Contents/Home/bin/java' 2>/dev/null | head -n 1 || true)"
  if [[ -n "$found" ]]; then
    echo "$(cd "$(dirname "$found")/.." && pwd)"
    return
  fi
  found="$(find "$JDK_ROOT" -maxdepth 6 -type f -path '*/bin/java' ! -path '*/Contents/*' 2>/dev/null | head -n 1 || true)"
  if [[ -n "$found" ]]; then
    echo "$(cd "$(dirname "$found")/.." && pwd)"
    return
  fi
  echo ""
}

JAVA_HOME_RESOLVED="$(resolve_java_home)"
if [[ -z "$JAVA_HOME_RESOLVED" ]]; then
  jdk_tgz="$DOWNLOADS/temurin-${JDK_MAJOR}-${jdk_arch}.tar.gz"
  if [[ ! -f "$jdk_tgz" ]]; then
    echo "Downloading Temurin JDK ${JDK_MAJOR} (${jdk_arch}) into $JDK_ROOT"
    jdk_url="${OPENTOPO_JDK_URL:-https://api.adoptium.net/v3/binary/latest/${JDK_MAJOR}/ga/mac/${jdk_arch}/jdk/hotspot/normal/eclipse?project=jdk}"
    curl -fL --retry 3 -o "$jdk_tgz" "$jdk_url"
  else
    echo "Extracting Temurin JDK ${JDK_MAJOR} from $jdk_tgz"
  fi
  rm -rf "$JDK_ROOT"
  mkdir -p "$JDK_ROOT"
  tar -xzf "$jdk_tgz" -C "$JDK_ROOT"
  JAVA_HOME_RESOLVED="$(resolve_java_home)"
fi
if [[ -z "$JAVA_HOME_RESOLVED" || ! -x "$JAVA_HOME_RESOLVED/bin/java" ]]; then
  echo "error: JDK not found under $JDK_ROOT" >&2
  exit 1
fi
export JAVA_HOME="$JAVA_HOME_RESOLVED"
export PATH="$JAVA_HOME/bin:$PATH"

# --- Android cmdline-tools ---
CMDLINE_DIR="$SDK_ROOT/cmdline-tools/latest"
SDKMANAGER="$CMDLINE_DIR/bin/sdkmanager"
AVDMANAGER="$CMDLINE_DIR/bin/avdmanager"

if [[ ! -x "$SDKMANAGER" && "$use_system" != "1" ]]; then
  echo "Downloading Android cmdline-tools ${CMDLINE_TOOLS_VERSION}"
  tools_zip="$DOWNLOADS/commandlinetools-mac-${CMDLINE_TOOLS_VERSION}_latest.zip"
  tools_url="${OPENTOPO_CMDLINE_TOOLS_URL:-https://dl.google.com/android/repository/commandlinetools-mac-${CMDLINE_TOOLS_VERSION}_latest.zip}"
  curl -fL --retry 3 -o "$tools_zip" "$tools_url"
  rm -rf "$SDK_ROOT/cmdline-tools"
  mkdir -p "$SDK_ROOT/cmdline-tools"
  tmp_extract="$DOWNLOADS/cmdline-tools-extract"
  rm -rf "$tmp_extract"
  mkdir -p "$tmp_extract"
  unzip -q "$tools_zip" -d "$tmp_extract"
  if [[ -d "$tmp_extract/cmdline-tools" ]]; then
    mv "$tmp_extract/cmdline-tools" "$CMDLINE_DIR"
  else
    mkdir -p "$CMDLINE_DIR"
    mv "$tmp_extract"/* "$CMDLINE_DIR/"
  fi
  rm -rf "$tmp_extract"
fi

if [[ ! -x "$SDKMANAGER" ]]; then
  echo "error: sdkmanager not found at $SDKMANAGER" >&2
  exit 1
fi

export ANDROID_HOME="$SDK_ROOT"
export ANDROID_SDK_ROOT="$SDK_ROOT"
export ANDROID_USER_HOME="$TOOLS_ROOT/android-user"
export ANDROID_AVD_HOME="$AVD_HOME"
mkdir -p "$ANDROID_USER_HOME"
export PATH="$SDK_ROOT/platform-tools:$SDK_ROOT/emulator:$CMDLINE_DIR/bin:$PATH"

run_sdkmanager() {
  # Accept licenses / install packages; ignore SIGPIPE from `yes`.
  # Use a temp file for exit code — PIPESTATUS/pipestatus differ across bash/zsh.
  local logrc
  logrc="$(mktemp)"
  (
    set +e
    yes 2>/dev/null | "$SDKMANAGER" --sdk_root="$SDK_ROOT" "$@"
    echo $? >"$logrc"
  )
  local sdk_rc
  sdk_rc="$(cat "$logrc" 2>/dev/null || echo 1)"
  rm -f "$logrc"
  return "$sdk_rc"
}

need_sdk_install=0
[[ -x "$SDK_ROOT/platform-tools/adb" ]] || need_sdk_install=1
[[ -d "$SDK_ROOT/platforms/${ANDROID_PLATFORM}" ]] || need_sdk_install=1
[[ -d "$SDK_ROOT/build-tools/${ANDROID_BUILD_TOOLS}" ]] || need_sdk_install=1
[[ -d "$SDK_ROOT/emulator" ]] || need_sdk_install=1
# Package id "system-images;android-36;google_apis;arm64-v8a" → sdk/system-images/android-36/...
sysimg_path="$SDK_ROOT/$(printf '%s' "$ANDROID_SYSTEM_IMAGE" | tr ';' '/')"
[[ -d "$sysimg_path" ]] || need_sdk_install=1

if [[ "$need_sdk_install" -eq 1 ]]; then
  echo "Installing Android SDK packages (platform ${ANDROID_PLATFORM}, build-tools ${ANDROID_BUILD_TOOLS})"
  run_sdkmanager --licenses >/dev/null || true
  # sdkmanager may exit 141 (SIGPIPE from `yes`); treat that as success if packages land.
  run_sdkmanager \
    "platform-tools" \
    "emulator" \
    "platforms;${ANDROID_PLATFORM}" \
    "build-tools;${ANDROID_BUILD_TOOLS}" \
    "${ANDROID_SYSTEM_IMAGE}" || true
  if [[ ! -x "$SDK_ROOT/platform-tools/adb" || ! -d "$sysimg_path" ]]; then
    echo "error: Android SDK install incomplete under $SDK_ROOT" >&2
    exit 1
  fi
else
  echo "Android SDK packages already present under $SDK_ROOT"
fi

avd_exists() {
  [[ -d "$AVD_HOME/${DEFAULT_AVD_NAME}.avd" ]]
}

if [[ -x "$AVDMANAGER" ]] && ! avd_exists; then
  echo "Creating AVD ${DEFAULT_AVD_NAME} (${ANDROID_SYSTEM_IMAGE})"
  echo no | "$AVDMANAGER" create avd \
    --force \
    --name "$DEFAULT_AVD_NAME" \
    --package "$ANDROID_SYSTEM_IMAGE" \
    --device "pixel_7"
fi

# Write local.properties for Gradle (gitignored).
LOCAL_PROPERTIES="$ROOT/android/local.properties"
if [[ -d "$ROOT/android" ]]; then
  {
    printf 'sdk.dir=%s\n' "$SDK_ROOT"
  } >"$LOCAL_PROPERTIES"
  echo "Wrote $LOCAL_PROPERTIES"
fi

export OPENTOPO_AVD_NAME="$DEFAULT_AVD_NAME"

echo "JAVA_HOME=$JAVA_HOME ($("$JAVA_HOME/bin/java" -version 2>&1 | head -n 1))"
echo "ANDROID_HOME=$ANDROID_HOME"
echo "ANDROID_AVD_HOME=$ANDROID_AVD_HOME"
echo "default AVD: $DEFAULT_AVD_NAME"
echo "adb: $(command -v adb || echo missing)"
