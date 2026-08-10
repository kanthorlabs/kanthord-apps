#!/usr/bin/env bash
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
snapshot="$here/turn-snapshot.sh"
failures=0

fail() {
  echo "FAIL  $1" >&2
  failures=$((failures + 1))
}

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
work=$tmp/repo
mkdir -p "$work"

git -C "$work" init -q
git -C "$work" config user.email guard@test
git -C "$work" config user.name guard
mkdir -p "$work/lib"
printf 'committed\n' >"$work/lib/tracked.dart"
git -C "$work" add -A
git -C "$work" commit -qm base

turn_files() {
  comm -3 "$tmp/before" "$tmp/after" | sed 's/^\t//' | cut -f2- | LC_ALL=C sort -u
}

printf 'committed\ndirty before the turn\n' >"$work/lib/tracked.dart"
"$snapshot" "$work" >"$tmp/before"
printf 'committed\ndirty before the turn\nedited by the turn\n' >"$work/lib/tracked.dart"
"$snapshot" "$work" >"$tmp/after"
[ "$(turn_files)" = "lib/tracked.dart" ] ||
  fail "an already-dirty file re-modified by the turn must be reported, got: $(turn_files)"

"$snapshot" "$work" >"$tmp/before"
"$snapshot" "$work" >"$tmp/after"
[ -z "$(turn_files)" ] ||
  fail "an unchanged dirty file must not be reported, got: $(turn_files)"

"$snapshot" "$work" >"$tmp/before"
printf 'new\n' >"$work/lib/added.dart"
"$snapshot" "$work" >"$tmp/after"
[ "$(turn_files)" = "lib/added.dart" ] ||
  fail "a new untracked file must be reported, got: $(turn_files)"

"$snapshot" "$work" >"$tmp/before"
printf 'committed\n' >"$work/lib/tracked.dart"
"$snapshot" "$work" >"$tmp/after"
[ "$(turn_files)" = "lib/tracked.dart" ] ||
  fail "a file reverted to HEAD must be reported, got: $(turn_files)"

"$snapshot" "$work" >"$tmp/before"
rm "$work/lib/tracked.dart"
"$snapshot" "$work" >"$tmp/after"
[ "$(turn_files)" = "lib/tracked.dart" ] ||
  fail "a deleted file must be reported, got: $(turn_files)"

git -C "$work" checkout -q -- lib/tracked.dart
git -C "$work" mv lib/tracked.dart lib/renamed.dart
"$snapshot" "$work" | cut -f2- | LC_ALL=C sort >"$tmp/renames"
printf 'lib/renamed.dart\nlib/tracked.dart\n' >"$tmp/renames-want"
if ! diff -q <(grep -E 'tracked|renamed' "$tmp/renames") "$tmp/renames-want" >/dev/null; then
  fail "a rename must appear as two plain paths, got: $(tr '\n' ' ' <"$tmp/renames")"
fi

if [ "$failures" -ne 0 ]; then
  echo "turn-snapshot.test.sh: $failures failure(s)" >&2
  exit 1
fi

echo "turn-snapshot.test.sh: PASS"
