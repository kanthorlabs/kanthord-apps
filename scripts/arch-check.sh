#!/usr/bin/env bash
set -uo pipefail

# The mechanically checkable subset of the CLAUDE.md and DESIGNS.md rules.
# Everything here is a grep with a fixed answer. A rule that needs judgment —
# whether an abstraction is speculative, whether a number is a design token or a
# business value — is the reviewer-engineer's, not this script's.
#
# usage: scripts/arch-check.sh [<path> ...]      (default: the whole lib/ tree)

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/.." && pwd)

if [ "$#" -gt 0 ]; then
  targets=("$@")
else
  cd "$root"
  targets=(lib)
fi

status=0

# Every dart file under the targets, generated output excluded — a builder's
# output is not hand-written code and is not bound by these rules.
sources=$(
  find "${targets[@]}" -name '*.dart' \
    ! -name '*.g.dart' ! -name '*.freezed.dart' \
    ! -name '*.mocks.dart' ! -name '*.gen.dart' 2>/dev/null | LC_ALL=C sort
)

if [ -z "$sources" ]; then
  echo "ARCH: PASS — no Dart source under ${targets[*]}"
  exit 0
fi

violation() {
  echo "arch violation: $1" >&2
  status=1
}

# scan <rule> <extended-regexp> [path-filter-regexp]
scan() {
  local rule=$1 pattern=$2 filter=${3:-.}
  local hits
  hits=$(printf '%s\n' "$sources" | grep -E "$filter" |
    xargs grep -HnE "$pattern" 2>/dev/null || true)
  [ -z "$hits" ] && return 0
  while IFS= read -r hit; do
    [ -n "$hit" ] && violation "$rule — $hit"
  done <<EOF
$hits
EOF
}

# --- CLAUDE.md: the dependency runs one way -------------------------------
scan "lib/api must not import the UI layers (CLAUDE.md, the SDK)" \
  "^import .*(features/|app/|libraries/)" '^lib/api/'
scan "the SDK knows nothing about Flutter (CLAUDE.md, the SDK)" \
  "^import 'package:flutter/" '^lib/api/'

# --- CLAUDE.md: no Clean Architecture -------------------------------------
scan "no repository, use case or entity-plus-DTO pair (CLAUDE.md)" \
  "(class|abstract class|mixin) [A-Za-z0-9_]*(Repository|UseCase|Entity|Mapper)\b"

# --- CLAUDE.md: the SDK return contract -----------------------------------
scan "a resource method returns a model, never Either or Result (CLAUDE.md)" \
  "\b(Either|Result)<" '^lib/api/'

# --- CLAUDE.md: navigation --------------------------------------------------
scan "navigation is go_router only, no Navigator.push (CLAUDE.md)" \
  "Navigator\.(push|pushNamed|pushReplacement|of\(context\)\.push)"

# --- CLAUDE.md: no chat surface, nothing streams ----------------------------
scan "nothing in this product streams (CLAUDE.md, docs/api/polling.md)" \
  "\b(AgentEvent|SseClientType|EventSource|SseClient)\b"
scan "a resource method never returns a Stream (CLAUDE.md, the SDK)" \
  "(Stream|StreamSubscription)<" '^lib/api/resources/'

# --- CLAUDE.md: logging -----------------------------------------------------
scan "logging is logger, never print or debugPrint (CLAUDE.md)" \
  "(^|[^A-Za-z0-9_.])(print|debugPrint)\("

# --- CLAUDE.md: comments are forbidden in hand-written Dart -----------------
scan "no comment in hand-written Dart outside a test (CLAUDE.md)" \
  "^[[:space:]]*(//|///)" '^lib/(api|features)/'

# --- DESIGNS.md: the KD prefix ----------------------------------------------
design_sources=$(printf '%s\n' "$sources" | grep -E '^lib/libraries/kd_design_system/' || true)
if [ -n "$design_sources" ]; then
  hits=$(printf '%s\n' "$design_sources" |
    xargs grep -HnE "^(final class|sealed class|abstract class|class|enum|mixin|typedef|extension) [A-Za-z0-9_]+" 2>/dev/null |
    grep -vE "^[^:]+:[0-9]+:[a-z ]*(final class|sealed class|abstract class|class|enum|mixin|typedef|extension) (KD|_)" || true)
  while IFS= read -r hit; do
    [ -n "$hit" ] && violation "every exported design-system symbol carries the KD prefix (DESIGNS.md) — $hit"
  done <<EOF
$hits
EOF
fi

# --- DESIGNS.md: a feature defines no atom and hard-codes no design value ----
scan "a feature hard-codes no design value (DESIGNS.md)" \
  "(Color\(0x|Colors\.[a-z]|TextStyle\(|BorderRadius\.circular\([0-9])" '^lib/features/'

if [ "$status" -eq 0 ]; then
  echo "ARCH: PASS — ${targets[*]}"
else
  echo "ARCH: FAIL — ${targets[*]}" >&2
fi

exit "$status"
