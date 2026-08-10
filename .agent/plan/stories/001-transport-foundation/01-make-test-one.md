# Story 01 — `make test-one`

Epic: `.agent/plan/epics/001-transport-foundation.md`

**APPLIED. No `/work` Task remains.** `scripts/lane-check.sh:45` denies `Makefile` to every role, so
the human applied this edit before dispatch. The record below is the change that landed. Neither the
test-engineer nor the software-engineer opens this file.

## Change

- `Makefile:29` — add `test-one` to the `.PHONY` list, after `test`:

  ```
  .PHONY: help bootstrap generate generate-lib generate-test format format-check \
  	analyze arch-check test test-one pipeline-test verify clean \
  	dev run-ios run-android run-macos run-windows run-linux run-web
  ```

- `Makefile:50` — add one help line after the `test` line, inside the `help:` recipe:

  ```
  	@echo "  test-one      Run one test file: make test-one T=<path>"
  ```

- `Makefile:113` — add the target after the `test:` target and before `arch-check:`:

  ```
  test-one:
  	$(FLUTTER) test $(T)
  ```

- Every recipe line uses a literal tab, never spaces.

## Constraints

- Do not change `test:`, `verify:` or any other target.
- Do not add a default value for `T`. An empty `T` runs the whole suite, and that is acceptable.
- `make verify` does not run `test-one`. The EPIC Proof calls it directly.

## Verify

- `make test-one T=test/libraries/kd_design_system/atoms/kd_button_test.dart` exits 0 and runs one
  file.
- `make verify` exits 0.
- Proof: none of its own. It is the precondition of `PASS 001-G1-CONFIG` through
  `PASS 001-G7-SYSTEM`.
