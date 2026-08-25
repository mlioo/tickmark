#!/usr/bin/env bash
# Ensure a project-local Ruby + CocoaPods sandbox under .tools/ruby.
# Never installs into system Ruby, Homebrew, or ~/.gem.
set -euo pipefail

# Resolve project root whether this file is executed or sourced (bash/zsh).
_opentopo_src="${BASH_SOURCE[0]:-$0}"
ROOT="$(cd "$(dirname "$_opentopo_src")/.." && pwd)"
unset _opentopo_src
TOOLS_ROOT="${OPENTOPO_RUBY_TOOLS:-$ROOT/.tools/ruby}"
RUNTIME_ROOT="$TOOLS_ROOT/runtime"
PORTABLE_RUBY_VERSION="${PORTABLE_RUBY_VERSION:-3.4.5}"
RUBY_PREFIX="$RUNTIME_ROOT/portable-ruby/${PORTABLE_RUBY_VERSION}"
GEM_HOME_DIR="$TOOLS_ROOT/gems"
PORTABLE_RUBY_URL="${PORTABLE_RUBY_URL:-https://github.com/Homebrew/homebrew-portable-ruby/releases/download/${PORTABLE_RUBY_VERSION}/portable-ruby-${PORTABLE_RUBY_VERSION}.arm64_big_sur.bottle.tar.gz}"
COCOAPODS_VERSION="${COCOAPODS_VERSION:-1.17.0}"

export HOME="${OPENTOPO_RUBY_HOME:-$TOOLS_ROOT/home}"
mkdir -p "$TOOLS_ROOT" "$HOME" "$GEM_HOME_DIR"

if [[ ! -x "$RUBY_PREFIX/bin/ruby" ]]; then
  echo "Downloading portable Ruby $PORTABLE_RUBY_VERSION into $RUNTIME_ROOT"
  mkdir -p "$RUNTIME_ROOT"
  tmp_tgz="$(mktemp /tmp/opentopo-portable-ruby.XXXXXX.tar.gz)"
  curl -fL --retry 3 -o "$tmp_tgz" "$PORTABLE_RUBY_URL"
  tar -xzf "$tmp_tgz" -C "$RUNTIME_ROOT"
  rm -f "$tmp_tgz"
fi

RUBY_BIN="$RUBY_PREFIX/bin/ruby"
GEM_BIN="$RUBY_PREFIX/bin/gem"
if [[ ! -x "$RUBY_BIN" || ! -x "$GEM_BIN" ]]; then
  echo "error: portable Ruby missing at $RUBY_PREFIX" >&2
  exit 1
fi

export GEM_HOME="$GEM_HOME_DIR"
export GEM_PATH="$GEM_HOME_DIR"
export PATH="$GEM_HOME_DIR/bin:$RUBY_PREFIX/bin:/usr/bin:/bin:/usr/sbin:/sbin"

if [[ ! -x "$GEM_HOME_DIR/bin/pod" ]] || ! "$GEM_HOME_DIR/bin/pod" --version >/dev/null 2>&1; then
  echo "Installing CocoaPods $COCOAPODS_VERSION into sandbox: $GEM_HOME_DIR"
  "$GEM_BIN" install cocoapods -v "$COCOAPODS_VERSION" --no-document --install-dir "$GEM_HOME_DIR"
fi

echo "ruby: $RUBY_BIN ($("$RUBY_BIN" -v))"
echo "pod:  $GEM_HOME_DIR/bin/pod ($("$GEM_HOME_DIR/bin/pod" --version))"
echo "GEM_HOME=$GEM_HOME_DIR"
