# Story 08 — the desktop-first check

Epic: `.agent/plan/epics/002-app-composition.md`
Depends on: Story 04 (the router renders the boot, unauthorized and gallery pages).

**This Story is verification only. It needs no `/work` Task and it changes no file.** The
`Makefile` half of G6 is already applied — `scripts/lane-check.sh:47` denies the `Makefile` to every
role, and commit `365fb2c` landed it. `Makefile:148` is `dev: run-web` and `Makefile:152` carries
`--web-port=$(WEB_PORT)`, so both greps of the EPIC Proof already answer 0.

## Change

None.

## Constraints

- Add no `Makefile` target and change no existing one.
- Add no widget test. Story 04 Task 004.1 already pumps every route at the `expanded` band.

## Verify

- `grep -q -- '--web-port=$(WEB_PORT)' Makefile` exits 0.
- `grep -q '^dev: run-web' Makefile` exits 0.
- `make verify` exits 0.
- `NEEDS-HUMAN:` **the launch that gates this EPIC.** `make dev` starts Chrome at
  `http://localhost:8080`. Check each of the three routes in the order below, and check the light
  theme and the dark theme at each band. `make verify` is headless and boots no browser.

  | Band       | Window width | Expected                                                    |
  | ---------- | ------------ | ----------------------------------------------------------- |
  | `expanded` | above `840`  | Check first. `/`, `/unauthorized` and `/gallery` all render |
  | `wide`     | `600`–`840`  | The same three routes render                                |
  | `mobile`   | below `600`  | The same three routes render                                |

  At `/` the store is empty on a fresh profile, so the page reads **No daemon configured**. At
  `/gallery` the theme toggle changes the whole application, which proves `ThemeModeController`
  reaches `MaterialApp.router`.

- `NEEDS-HUMAN:` carried forward, and none of these blocks the EPIC — `make run-macos`,
  `make run-ios`, `make run-android`, `make run-windows`, `make run-linux`. Windows and Linux have
  never been compiled.
- Proof: `PASS 002-G6-DEV-HOST`.
