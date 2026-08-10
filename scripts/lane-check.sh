#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: scripts/lane-check.sh <test-engineer|software-engineer|reviewer-engineer> <path>" >&2
  exit 2
}

[ "$#" -eq 2 ] || usage

role=$1
path=$2

case $role in
test-engineer | software-engineer | reviewer-engineer) ;;
*) usage ;;
esac

[ -n "$path" ] || usage

path=${path#./}

deny() {
  echo "lane violation: $role changed $path ($1)" >&2
  exit 1
}

case $path in
/*) deny "path is not repo-relative" ;;
../* | */../*) deny "path escapes the repo root" ;;
*" -> "*) deny "a porcelain rename record — the caller must pass each side alone" ;;
'"'*) deny "a quoted porcelain path — the caller must unquote it" ;;
esac

case $path in
.agent/plan/*) deny "the plan tree is locked" ;;
.claude/* | .opencode/*) deny "the pipeline definition is locked" ;;
scripts/lane-check.sh | scripts/turn-snapshot.sh | scripts/verify-handoff.sh | scripts/memory-append-only.sh | scripts/arch-check.sh | scripts/*.test.sh)
  deny "the pipeline guards are locked"
  ;;
pubspec.yaml | pubspec.lock) deny "the dependency manifest is locked" ;;
package.json | package-lock.json) deny "the toolchain manifest is locked" ;;
analysis_options.yaml | build.yaml | .fvmrc) deny "the toolchain config is locked" ;;
Makefile) deny "the build definition is locked" ;;
CLAUDE.md | AGENTS.md | DESIGNS.md | HANDOFF.md | README.md) deny "the project contract is locked" ;;
docs/*) deny "the documentation tree is locked" ;;
android/* | ios/* | macos/* | linux/* | windows/* | web/*) deny "a platform directory is locked" ;;
.husky/* | .github/*) deny "the hook and CI definitions are locked" ;;
esac

case ${path##*/} in
*.config.*) deny "the toolchain config is locked" ;;
esac

if [ "$role" = reviewer-engineer ]; then
  deny "the reviewer-engineer edits nothing"
fi

case $path in
.agent/tdd/memory/*)
  rest=${path#.agent/tdd/memory/}
  case $rest in
  test-engineer/* | software-engineer/* | reviewer-engineer/*)
    [ "${rest%%/*}" = "$role" ] || deny "another role's journal"
    ;;
  test-engineer | software-engineer | reviewer-engineer)
    deny "a role journal name is a directory, not a file"
    ;;
  */*) deny "an unknown journal namespace" ;;
  esac
  exit 0
  ;;
.agent/tdd/*) exit 0 ;;
esac

case $path in
test/* | integration_test/*)
  [ "$role" = test-engineer ] || deny "the test tree is the test-engineer lane"
  exit 0
  ;;
lib/* | assets/*)
  [ "$role" = software-engineer ] || deny "the production tree is the software-engineer lane"
  exit 0
  ;;
scripts/*)
  [ "$role" = software-engineer ] || deny "scripts are the software-engineer lane"
  exit 0
  ;;
esac

deny "outside every lane"
