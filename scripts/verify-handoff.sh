#!/usr/bin/env bash
set -uo pipefail

# Re-verifies one role's handoff gate. It reproduces the gate, it never trusts
# the claim. Read .claude/agents/<role>.md for what each role must run.
#
#   software-engineer: the pinned SDK, `make generate-lib`, generated output is
#                      current, `flutter analyze lib`, `scripts/arch-check.sh`
#   test-engineer:     the pinned SDK, `make generate-test`, generated output is
#                      current, `flutter analyze`

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/.." && pwd)

usage() {
  echo "usage: scripts/verify-handoff.sh <software-engineer|test-engineer>" >&2
  exit 2
}

[ "$#" -eq 1 ] || usage
role=$1

case $role in
software-engineer)
  generate_target=generate-lib
  generated_glob='lib'
  analyze_scope='lib'
  ;;
test-engineer)
  generate_target=generate-test
  generated_glob='test'
  analyze_scope=''
  ;;
*) usage ;;
esac

fail() {
  echo "VERIFY: FAIL — $1"
  exit 1
}

if command -v fvm >/dev/null 2>&1; then
  FLUTTER="fvm flutter"
else
  FLUTTER="flutter"
fi

# 1. The pinned SDK. The Makefile falls back to the ambient toolchain when fvm
# is absent, so a gate that skips this can pass on the wrong Flutter.
pinned=$(sed -n 's/.*"flutter"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$root/.fvmrc")
[ -n "$pinned" ] || fail "no flutter version pin in .fvmrc"

actual=$($FLUTTER --version 2>/dev/null | sed -n '1s/^Flutter \([^ ]*\).*/\1/p')
[ -n "$actual" ] || fail "$FLUTTER --version produced no version line"
[ "$actual" = "$pinned" ] ||
  fail "the SDK is $actual, the pin is $pinned — run make bootstrap"

# 2. Generated output must already be current. Running the builder is a
# mutation, not a proof, so the gate is whether the builder changes anything.
generated_hashes() {
  find "$root/$generated_glob" \
    -name '*.g.dart' -o -name '*.freezed.dart' \
    -o -name '*.mocks.dart' -o -name '*.gen.dart' 2>/dev/null |
    LC_ALL=C sort |
    while IFS= read -r f; do
      printf '%s  %s\n' "$(git -C "$root" hash-object -- "$f")" "${f#"$root"/}"
    done
}

before=$(generated_hashes)
generate_log=$(make -C "$root" "$generate_target" 2>&1) || {
  printf '%s\n' "$generate_log"
  fail "make $generate_target exited non-zero"
}
after=$(generated_hashes)

if [ "$before" != "$after" ]; then
  printf '%s\n' "$(diff <(printf '%s\n' "$before") <(printf '%s\n' "$after") || true)"
  fail "generated output under $generated_glob/ was stale — commit the regenerated files"
fi

# 3. Static analysis over the role's lane.
if ! analyze_log=$($FLUTTER analyze $analyze_scope 2>&1); then
  printf '%s\n' "$analyze_log"
  fail "flutter analyze ${analyze_scope:-.} reported errors"
fi

# 4. The mechanical architecture and design rules, over the production tree.
if [ "$role" = software-engineer ]; then
  if ! arch_log=$("$here/arch-check.sh" 2>&1); then
    printf '%s\n' "$arch_log"
    fail "scripts/arch-check.sh reported violations"
  fi
fi

echo "VERIFY: PASS — $pinned, generated output current, flutter analyze ${analyze_scope:-.} clean"
