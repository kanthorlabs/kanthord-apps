#!/usr/bin/env bash
set -uo pipefail

root=$(cd -- "$(dirname -- "$0")/.." && pwd)
predicate="$root/scripts/lane-check.sh"

failures=0

expect() {
  local want=$1 role=$2 path=$3
  local got
  "$predicate" "$role" "$path" >/dev/null 2>&1
  got=$?
  if [ "$got" -ne "$want" ]; then
    echo "FAIL: lane-check.sh $role '$path' exited $got, wanted $want" >&2
    failures=$((failures + 1))
  fi
}

allow() { expect 0 "$1" "$2"; }
deny() { expect 1 "$1" "$2"; }

# usage
expect 2 test-engineer ""
"$predicate" nobody src/a.ts >/dev/null 2>&1
[ "$?" -eq 2 ] || {
  echo "FAIL: an unknown role must exit 2" >&2
  failures=$((failures + 1))
}

# production source
allow software-engineer src/api/client.ts
allow software-engineer src/lib/utils.ts
deny test-engineer src/api/client.ts
deny test-engineer src/lib/utils.ts

# tests
allow test-engineer src/api/client.test.ts
allow test-engineer src/components/button.test.tsx
deny software-engineer src/api/client.test.ts
deny software-engineer src/components/button.test.tsx

# test helpers, and the locked bootstrap beside them
allow test-engineer test/helpers/api.ts
deny software-engineer test/helpers/api.ts
deny test-engineer test/setup.ts
deny software-engineer test/setup.ts

# scripts are the software-engineer lane, the guards are nobody's
allow software-engineer scripts/acceptance-provider.sh
deny test-engineer scripts/acceptance-provider.sh
deny software-engineer scripts/lane-check.sh
deny software-engineer scripts/turn-snapshot.sh
deny software-engineer scripts/verify-handoff.mjs
deny software-engineer scripts/lane-check.test.sh
deny software-engineer scripts/persona-sync.test.sh

# the toolchain is locked to every role
deny software-engineer package.json
deny software-engineer pnpm-lock.yaml
deny software-engineer tsconfig.json
deny software-engineer tsconfig.base.json
deny software-engineer vite.config.ts
deny software-engineer eslint.config.mjs
deny software-engineer .nvmrc
deny software-engineer .npmrc
deny software-engineer .editorconfig
deny software-engineer .husky/pre-commit
deny software-engineer AGENTS.md
deny software-engineer docs/overview.md

# the plan tree and the pipeline definition are locked
deny software-engineer .agents/plan/an-initiative/01-objective/01-task.md
deny test-engineer .agents/plan/an-initiative/01-objective/01-task.md
deny software-engineer .claude/agents/software-engineer.md
deny test-engineer .opencode/agents/test-engineer.md

# the discussion tree is open to both engineers
allow test-engineer .agents/tdd/history/2026-09-18-an-objective.md
allow software-engineer .agents/tdd/history/2026-09-18-an-objective.md
allow test-engineer .agents/tdd/.test-engineer-response-01.md

# the reviewer-engineer edits nothing
deny reviewer-engineer src/api/client.ts
deny reviewer-engineer src/api/client.test.ts
deny reviewer-engineer .agents/tdd/history/2026-09-18-an-objective.md
deny reviewer-engineer scripts/acceptance-provider.sh

# malformed input is never in lane
deny software-engineer /etc/passwd
deny software-engineer ../outside/file.ts
deny software-engineer "src/a.ts -> src/b.ts"
deny software-engineer '"src/a.ts"'

# nothing outside a named lane
deny software-engineer README.md
deny software-engineer index.html
deny test-engineer LICENSE

if [ "$failures" -eq 0 ]; then
  echo "LANE-CHECK TESTS: PASS"
  exit 0
fi

echo "LANE-CHECK TESTS: FAIL ($failures)" >&2
exit 1
