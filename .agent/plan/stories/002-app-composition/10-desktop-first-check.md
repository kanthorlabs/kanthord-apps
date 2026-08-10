# Story 10 — the desktop-first check

Epic: `.agent/plan/epics/002-app-composition.md`
Depends on: Story `08` (the router renders the boot, unauthorized and gallery pages).

**This Story is verification only. It needs no `/work` Task and it changes no file.** The `Makefile`
half of G9 is already applied — `scripts/lane-check.sh:44` denies the `Makefile` to every role.
`Makefile:152` is `dev: run-web` and `Makefile:156` carries `--web-port=$(WEB_PORT)`, with
`WEB_PORT ?= 8080` at `Makefile:36`, so both greps of the EPIC Proof already answer 0.

## Change

None.

## Constraints

- Add no `Makefile` target and change no existing one.
- Add no widget test. Story `08` Task 008.1 already pumps every route at the `expanded` band.
- Change no `WEB_PORT` value. The daemon matches an origin exactly, so the port is pinned.

## Verify

- `grep -q -- '--web-port=$(WEB_PORT)' Makefile` exits 0.
- `grep -q '^dev: run-web' Makefile` exits 0.
- `make verify` exits 0.
- `NEEDS-HUMAN:` **the launch that gates this EPIC.** `make dev` starts Chrome at
  `http://localhost:8080`. Check each of the three routes in the order below, and check the light theme
  and the dark theme at each band. `make verify` is headless and boots no browser.

  | Band       | Window width | Expected                                                    |
  | ---------- | ------------ | ----------------------------------------------------------- |
  | `expanded` | above `840`  | Check first. `/`, `/unauthorized` and `/gallery` all render |
  | `wide`     | `600`–`840`  | The same three routes render                                |
  | `mobile`   | below `600`  | The same three routes render                                |

  At `/` on a fresh browser profile the registry is empty, so `main()` seeds one daemon and the page
  reads **local** over **http://localhost:31415**. Reload once and confirm the page reads the same
  thing and the registry still holds one daemon, which is the G5 run-one-time rule in the real host.
  At `/gallery` the theme toggle changes the whole application, which proves `ThemeModeController`
  reaches `MaterialApp.router`.

- `NEEDS-HUMAN:` that a web build resolves `MemoryDaemonCredentialStore`, because `kIsWeb` is true
  there. Story `07` proves both branches of `buildCredentialStore` headless and proves nothing about
  the value `kIsWeb` takes in Chrome.
- `NEEDS-HUMAN:` carried forward, and none of these blocks the EPIC — `make run-macos`,
  `make run-ios`, `make run-android`, `make run-windows`, `make run-linux`. Windows and Linux have
  never been compiled.
- Proof: `PASS 002-G9-DEV-HOST`.
