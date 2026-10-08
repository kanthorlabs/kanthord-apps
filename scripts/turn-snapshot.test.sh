#!/usr/bin/env bash
set -uo pipefail

# A git hook exports GIT_DIR, GIT_INDEX_FILE and friends. Those variables
# override "git -C", so every git call below would resolve to the caller's
# repository instead of the temporary one, and would corrupt it. Clear them
# before the first git call.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_OBJECT_DIRECTORY \
  GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_COMMON_DIR GIT_QUARANTINE_PATH \
  GIT_PREFIX GIT_CONFIG GIT_CONFIG_COUNT GIT_CONFIG_GLOBAL GIT_CONFIG_SYSTEM

root=$(cd -- "$(dirname -- "$0")/.." && pwd)
snapshot="$root/scripts/turn-snapshot.sh"

failures=0
fail() {
  echo "FAIL: $1" >&2
  failures=$((failures + 1))
}

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

git -C "$work" init -q
mkdir -p "$work/src"
printf 'one\n' > "$work/src/kept.ts"
printf 'two\n' > "$work/src/removed.ts"
git -C "$work" add -A
git -C "$work" -c user.email=guard@test -c user.name=guard commit -qm base

# a clean tree reports nothing
if [ -n "$("$snapshot" "$work")" ]; then
  fail "a clean tree must produce an empty snapshot"
fi

# an untracked file, a modified file and a deleted file each appear once
printf 'new\n' > "$work/src/added.ts"
printf 'one changed\n' > "$work/src/kept.ts"
rm "$work/src/removed.ts"
before=$("$snapshot" "$work")

for path in src/added.ts src/kept.ts src/removed.ts; do
  count=$(printf '%s\n' "$before" | grep -c "	$path\$")
  [ "$count" -eq 1 ] || fail "$path appeared $count times, wanted 1"
done

printf '%s\n' "$before" | grep -q "^ABSENT	src/removed.ts\$" ||
  fail "a deleted path must carry ABSENT in place of a hash"

# the output is sorted for comm
if [ "$before" != "$(printf '%s\n' "$before" | LC_ALL=C sort)" ]; then
  fail "the snapshot must be sorted with LC_ALL=C"
fi

# a second edit to an already-dirty file changes its fingerprint
printf 'one changed twice\n' > "$work/src/kept.ts"
after=$("$snapshot" "$work")
kept_before=$(printf '%s\n' "$before" | grep "	src/kept.ts\$")
kept_after=$(printf '%s\n' "$after" | grep "	src/kept.ts\$")
[ "$kept_before" != "$kept_after" ] ||
  fail "an edit to an already-dirty file must change its fingerprint"

# a path holding a space survives as one record
printf 'spaced\n' > "$work/src/with space.ts"
"$snapshot" "$work" | grep -q "	src/with space.ts\$" ||
  fail "a path with a space must appear as one record"

# A git hook exports GIT_DIR and GIT_INDEX_FILE. The snapshot takes an explicit
# root, so it must report that root and never the repository those variables
# name. This is the condition that corrupted a real repository once.
decoy=$(mktemp -d)
git init -q "$decoy"
leaked=$(GIT_DIR="$decoy/.git" GIT_WORK_TREE="$decoy" GIT_INDEX_FILE="$decoy/.git/index" \
  "$snapshot" "$work")
printf '%s\n' "$leaked" | grep -q "	src/kept.ts\$" ||
  fail "the snapshot must honour its root argument, not an inherited GIT_DIR"
rm -rf "$decoy"

if [ "$failures" -eq 0 ]; then
  echo "TURN-SNAPSHOT TESTS: PASS"
  exit 0
fi

echo "TURN-SNAPSHOT TESTS: FAIL ($failures)" >&2
exit 1
