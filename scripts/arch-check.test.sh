#!/usr/bin/env bash
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
guard="$here/arch-check.sh"
failures=0

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/lib/api/resources" "$work/lib/api/models" "$work/lib/features/connect" \
  "$work/lib/libraries/kd_design_system/atoms"

run() { (cd "$work" && "$guard" "$@" 2>&1); }

# `case` fixture <path> <content> — one file per assertion, removed after it
case_fail() {
  local what=$1 path=$2 content=$3
  printf '%s\n' "$content" >"$work/$path"
  if run lib | grep -q '^ARCH: PASS'; then
    echo "FAIL  $what — expected a violation, got PASS" >&2
    failures=$((failures + 1))
  fi
  rm -f "$work/$path"
}

case_pass() {
  local what=$1
  if ! run lib | grep -q '^ARCH: PASS'; then
    echo "FAIL  $what — expected PASS, got:" >&2
    run lib >&2
    failures=$((failures + 1))
  fi
}

# A clean tree passes.
printf 'final class SystemResource {\n  Future<int> list() async => 1;\n}\n' \
  >"$work/lib/api/resources/system_resource.dart"
printf 'final class KDButton {}\n' \
  >"$work/lib/libraries/kd_design_system/atoms/kd_button.dart"
printf 'final class ConnectPage {}\n' \
  >"$work/lib/features/connect/connect_page.dart"
case_pass "a conforming tree"

case_fail "the SDK importing the UI layer" lib/api/bad.dart \
  "import '../features/connect/connect_bloc.dart';"
case_fail "the SDK importing Flutter" lib/api/bad.dart \
  "import 'package:flutter/material.dart';"
case_fail "a repository class" lib/api/bad.dart \
  "abstract class NodeRepository {}"
case_fail "a use case class" lib/features/connect/bad.dart \
  "final class ConnectUseCase {}"
case_fail "an Either return" lib/api/bad.dart \
  "Either<String, int> load() => throw 1;"
case_fail "Navigator.push" lib/features/connect/bad.dart \
  "void go() => Navigator.push(context, route);"
case_fail "an AgentEvent type" lib/features/connect/bad.dart \
  "final class AgentEvent {}"
case_fail "an SDK method returning a Stream" lib/api/bad.dart \
  "Stream<int> watch() => throw 1;"
case_fail "print in production" lib/features/connect/bad.dart \
  "void go() { print('x'); }"
case_fail "a comment in hand-written Dart" lib/features/connect/bad.dart \
  "// this explains something"
case_fail "a design-system symbol without the KD prefix" \
  lib/libraries/kd_design_system/atoms/bad.dart \
  "final class FancyButton {}"
case_fail "a hard-coded colour in a feature" lib/features/connect/bad.dart \
  "final c = Color(0xFF00FF00);"
case_fail "a hard-coded text style in a feature" lib/features/connect/bad.dart \
  "final s = TextStyle(fontSize: 12);"

# Generated output is exempt.
printf '// GENERATED CODE\nfinal class NotKD {}\nStream<int> x() => throw 1;\n' \
  >"$work/lib/api/models/thing.freezed.dart"
case_pass "generated output is exempt"

if [ "$failures" -ne 0 ]; then
  echo "arch-check.test.sh: $failures failure(s)" >&2
  exit 1
fi

echo "arch-check.test.sh: PASS"
