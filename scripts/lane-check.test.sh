#!/usr/bin/env bash
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
guard="$here/lane-check.sh"
failures=0

expect() {
  local want=$1 role=$2 path=$3
  local got=0
  "$guard" "$role" "$path" >/dev/null 2>&1 || got=$?
  if [ "$got" -ne "$want" ]; then
    echo "FAIL  want=$want got=$got  $role  $path" >&2
    failures=$((failures + 1))
  fi
}

allow() { expect 0 "$1" "$2"; }
deny() { expect 1 "$1" "$2"; }
usage() { expect 2 "$1" "$2"; }

allow test-engineer test/api/resources/system_resource_test.dart
allow test-engineer test/features/daemon_connect/daemon_connect_bloc_test.dart
allow test-engineer ./test/api/resources/system_resource_test.dart
allow test-engineer test/api/resources/system_resource_test.mocks.dart
allow test-engineer test/mock_daemon/mock_daemon.dart
allow test-engineer test/mock_daemon/fixtures/system.status.json
allow test-engineer integration_test/app_test.dart
deny test-engineer lib/api/resources/system_resource.dart
deny test-engineer lib/main.dart
deny test-engineer scripts/proof.sh
deny test-engineer assets/logo.svg

allow software-engineer lib/api/resources/system_resource.dart
allow software-engineer lib/api/models/system_status.freezed.dart
allow software-engineer lib/main.dart
allow software-engineer scripts/proof.sh
allow software-engineer assets/logo.svg
deny software-engineer test/api/resources/system_resource_test.dart
deny software-engineer test/mock_daemon/mock_daemon.dart
deny software-engineer test/api/resources/system_resource_test.mocks.dart
deny software-engineer integration_test/app_test.dart

allow test-engineer .agent/tdd/history/2026-08-10-001-transport.md
allow test-engineer .agent/tdd/.test-engineer-response-t1.md
allow test-engineer .agent/tdd/memory/flutter-gotchas.md
allow test-engineer .agent/tdd/memory/test-engineer/2026-08-10.md
allow software-engineer .agent/tdd/memory/software-engineer/2026-08-10.md
deny test-engineer .agent/tdd/memory/software-engineer/2026-08-10.md
deny software-engineer .agent/tdd/memory/test-engineer/2026-08-10.md
deny test-engineer .agent/tdd/memory/reviewer-engineer/2026-08-10.md
deny test-engineer .agent/tdd/memory/unknown/2026-08-10.md
deny test-engineer .agent/tdd/memory/software-engineer-other/2026-08-10.md
deny test-engineer .agent/tdd/memory/software-engineer

for role in test-engineer software-engineer; do
  deny "$role" .agent/plan/stories/epic/story.md
  deny "$role" .claude/commands/work.md
  deny "$role" .opencode/agents/software-engineer.md
  deny "$role" scripts/lane-check.sh
  deny "$role" scripts/lane-check.test.sh
  deny "$role" scripts/turn-snapshot.sh
  deny "$role" scripts/verify-handoff.sh
  deny "$role" scripts/memory-append-only.sh
  deny "$role" scripts/arch-check.sh
  deny "$role" scripts/arch-check.test.sh
  deny "$role" pubspec.yaml
  deny "$role" pubspec.lock
  deny "$role" analysis_options.yaml
  deny "$role" build.yaml
  deny "$role" .fvmrc
  deny "$role" package.json
  deny "$role" package-lock.json
  deny "$role" lint-staged.config.mjs
  deny "$role" commitlint.config.mjs
  deny "$role" Makefile
  deny "$role" CLAUDE.md
  deny "$role" AGENTS.md
  deny "$role" DESIGNS.md
  deny "$role" HANDOFF.md
  deny "$role" README.md
  deny "$role" docs/api/README.md
  deny "$role" docs/api/contract/features/system.yaml
  deny "$role" ios/Runner/Info.plist
  deny "$role" android/app/build.gradle
  deny "$role" macos/Runner/Info.plist
  deny "$role" web/index.html
  deny "$role" windows/runner/main.cpp
  deny "$role" linux/my_application.cc
  deny "$role" .husky/pre-commit
  deny "$role" /etc/passwd
  deny "$role" ../outside.dart
  deny "$role" "lib/old.dart -> lib/new.dart"
  deny "$role" "test/a_test.dart -> lib/b.dart"
  deny "$role" '"lib/a b.dart"'
done

deny reviewer-engineer lib/api/resources/system_resource.dart
deny reviewer-engineer test/api/resources/system_resource_test.dart
deny reviewer-engineer .agent/tdd/history/2026-08-10-001-transport.md
deny reviewer-engineer .agent/tdd/memory/reviewer-engineer/2026-08-10.md

usage bogus-role lib/a.dart
usage test-engineer ""

if [ "$failures" -ne 0 ]; then
  echo "lane-check.test.sh: $failures failure(s)" >&2
  exit 1
fi

echo "lane-check.test.sh: PASS"
