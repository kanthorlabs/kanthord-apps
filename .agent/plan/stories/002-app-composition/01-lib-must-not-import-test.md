# Story 01 — the `lib` must not import `test` rule

Epic: `.agent/plan/epics/002-app-composition.md`
Depends on: none.

**This Story is human-applied and needs no `/work` Task. It is APPLIED.** `scripts/lane-check.sh:38-40`
denies `scripts/arch-check.sh` and `scripts/*.test.sh` to every role, so no agent can write either
file. It stands first because Stories `02` through `09` each verify `make arch-check`.

## Change

None. Both edits are on disk.

- `scripts/arch-check.sh:73-75` holds the rule:

  ```bash
  # --- CLAUDE.md: the production tree never imports the test tree --------------
  scan "lib must not import the test tree (CLAUDE.md)" \
    "^[[:space:]]*import[[:space:]]+['\"](\.\./)*test/" '^lib/'
  ```

- `scripts/arch-check.test.sh:60-63` holds both self-test cases:

  ```bash
  case_fail "lib importing the test tree" lib/features/connect/bad.dart \
    "import '../../../test/api/dio_mock_adapter.dart';"
  case_fail "lib importing the test tree with double quotes" lib/features/connect/bad.dart \
    "import \"../../../test/api/dio_mock_adapter.dart\";"
  ```

## Constraints

- Change neither file. Both are locked to every role.
- The rule inherits the generated-file exclusion at `scripts/arch-check.sh:25-29`.
- The scan says nothing about `package:flutter_test/`. That is a separate rule nobody asked for.

## Verify

- `scripts/arch-check.test.sh` prints `arch-check.test.sh: PASS`.
- `make pipeline-test` exits 0. `Makefile:123-127` runs `scripts/arch-check.test.sh` as its fourth
  entry.
- `make arch-check` exits 0 over the current tree.
- `make verify` exits 0.
- Proof: none. The EPIC lists this rule under **Hermetic coverage required beyond the Proof**.
  `PASS 002-G7-NAVIGATION` is the `Navigator.push` grep at `scripts/arch-check.sh:70-71`, which
  Story `08` delivers.
