# Story 06 — the `lib` must not import `test` rule

Epic: `.agent/plan/epics/002-app-composition.md`
Depends on: none.

**This Story is human-applied and needs no `/work` Task. It is APPLIED.**
`scripts/lane-check.sh:40-42` denies both `scripts/arch-check.sh` and `scripts/*.test.sh` to every
role, so no agent can write either file. The human applied both edits before the EPIC 002 dispatch,
because Story 01 through Story 05 each verify `make arch-check`. `scripts/arch-check.test.sh`
prints `arch-check.test.sh: PASS` and `scripts/arch-check.sh` prints `ARCH: PASS — lib` over the
current tree.

## Change

- `scripts/arch-check.sh`, insert after line 71 — the anchor is the line
  `"Navigator\.(push|pushNamed|pushReplacement|of\(context\)\.push)"`, and the new block goes
  immediately before the comment line `# --- CLAUDE.md: no chat surface, nothing streams`:

  ```bash
  # --- CLAUDE.md: the production tree never imports the test tree ------------
  scan "lib must not import the test tree (CLAUDE.md)" \
    "^[[:space:]]*import[[:space:]]+['\"](\.\./)*test/" '^lib/'
  ```

  The pattern accepts both quote styles and leading whitespace, so
  `import "../../test/x.dart";` and an indented import are both caught. `package:kanthord/` cannot
  address `test/`, so a relative import is the only reachable form.

- `scripts/arch-check.test.sh`, insert after line 59 — the anchor is the
  `case_fail "a resource method returning a Stream"` block, and the new cases go immediately before
  the comment line `# docs/api/polling.md gives EventPoller a Stream`:

  ```bash
  case_fail "lib importing the test tree" lib/features/connect/bad.dart \
    "import '../../../test/api/dio_mock_adapter.dart';"
  case_fail "lib importing the test tree with double quotes" lib/features/connect/bad.dart \
    "import \"../../../test/api/dio_mock_adapter.dart\";"
  ```

  `case_pass "a conforming tree"` at line 42 already proves the clean tree stays green, because the
  three fixture files it writes declare no import.

## Constraints

- One rule and two self-test cases, one per quote style. The scan says nothing about
  `package:flutter_test/`, which is a separate rule nobody has asked for.
- The new block sits inside the existing `scan` mechanism, so it inherits the generated-file
  exclusion at `scripts/arch-check.sh:25-29`.
- No other rule changes.

## Verify

- `scripts/arch-check.test.sh` prints `arch-check.test.sh: PASS`.
- `make pipeline-test` exits 0.
- `make arch-check` exits 0 over the current tree.
- `make verify` exits 0.
- Proof: none. This Story delivers no `PASS` marker. The EPIC lists the rule under **Hermetic
  coverage required beyond the Proof**, and `PASS 002-G4-NAVIGATION` is the `Navigator.push` check
  that `scripts/arch-check.sh:70-71` already implements and Story 04 delivers. This Story keeps
  `make arch-check` green over the enlarged rule set and adds the required hermetic coverage.
