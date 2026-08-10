# EPIC 002 — App composition

Status: **ready**.

`lib/app/` has no dependency injection and no router, and `kanthord_app.dart` still opens the
gallery. This epic wires the SDK into the app and stores the two values the human enters. It exists
so that EPIC 003 is a running application and not a library test.

## Goal

- **G1** — `get_it` registers `KanthordApi` one time as a lazy singleton, plus the
  `TokenProviderType` and `BaseUrlProviderType` implementations selected per platform.
- **G2** — `lib/app/token/` holds two implementations: `flutter_secure_storage` on native, memory on
  web. Neither writes the token to `shared_preferences` and neither writes it to `localStorage`.
- **G3** — `lib/app/settings/` implements `BaseUrlProviderType` over `shared_preferences`. It holds
  no token. It stores no default, and an unset base URL is a state the app renders. The
  `http://localhost:31415` convention reaches the human as a prefilled field in EPIC 003, never as a
  value the store invents.
- **G4** — `go_router` replaces `home: KDGalleryPage(...)`. The router declares the boot route, the
  unauthorized route and a development gallery route. Every route is `@TypedGoRoute`, and
  `make arch-check` proves no `Navigator.push` anywhere.
- **G5** — `lib/app/env/` holds the `envied` classes and a committed `.env.example`. `.gitignore`
  ignores `.env*` and admits `.env.example`, so the example is the reproducible artifact and the two
  real files are per-developer. No env file holds a daemon token or a server secret.
- **G6** — The development host is Chrome. `make dev` runs the app at `http://localhost:8080` with the
  port pinned in the `Makefile`, and no gate and no story needs a simulator or an emulator. The daemon
  side is `KANTHORD_HTTP_ALLOWED_ORIGINS=http://localhost:8080`, which the engine already implements.
- **G7** — The cleartext posture of `docs/api/connectivity.md` lands: Android and iOS permit
  cleartext to any host in every build variant, and `scripts/platform-config-check.sh` asserts the
  permission is present on both.

## Non-goals

- No feature page and no product route. EPIC 003 owns the first one. The boot route renders a status
  view and nothing more.
- No host-scoped cleartext exception. A build-time file cannot name a host the human types at
  runtime, and the decision is a broad permission instead. Read the cleartext section of
  `docs/api/connectivity.md`.
- No daemon token in any env file. A web build ships readable JavaScript.
- No default base URL in production code. A compile-time development default from `envied` is
  allowed, and it is never a fallback.
- No simulated entry point, no simulation marker and no capability reporting. There is no simulated
  screen yet and no integration harness to run one. EPIC 004 delivers the release-safety half.
- No new dependency. Every package this epic needs is in `pubspec.yaml`.
- No new `KD` component.

## Verification gate

Gates: `make verify`

Proof:

```bash
make test-one T=test/app/injection_test.dart \
  && echo "PASS 002-G1-DI" \
  && make test-one T=test/app/token \
  && echo "PASS 002-G2-TOKEN-STORE" \
  && make test-one T=test/app/settings \
  && echo "PASS 002-G3-BASE-URL-STORE" \
  && make test-one T=test/app/router_test.dart \
  && echo "PASS 002-G4-ROUTER" \
  && make arch-check \
  && echo "PASS 002-G4-NAVIGATION" \
  && make test-one T=test/app/env_test.dart \
  && echo "PASS 002-G5-ENV" \
  && grep -q -- '--web-port=$(WEB_PORT)' Makefile && grep -q '^dev: run-web' Makefile \
  && echo "PASS 002-G6-DEV-HOST" \
  && scripts/platform-config-check.sh \
  && echo "PASS 002-G7-PLATFORM" \
  && echo "PASS EPIC-002"
```

`scripts/platform-config-check.sh` is written by this epic and it proves one grep per mobile target:
the cleartext permission is declared. It cannot prove a build-time file admits a runtime host, and it
claims no such thing.

Hermetic coverage required beyond the Proof:

- The injection root registers `KanthordApi` one time. A second `getIt<KanthordApi>()` returns the
  same instance.
- The token store test asserts a written token is readable, that `clear` removes it, and that the web
  implementation loses it when the instance is discarded.
- The base URL store returns null before any write, and the app renders the unset state rather than
  calling a daemon.
- No file under `lib/` imports a path under `test/`. `scripts/arch-check.sh` gains this rule and its
  self-test in `scripts/arch-check.test.sh`.
- The router test asserts every declared route is typed. `arch-check` proves the absence of
  `Navigator.push` and proves nothing about the route declarations, so the two checks are separate.

`NEEDS-HUMAN:` a real launch. **Chrome at the pinned port is the one that gates this epic**, because
it is the development host. macOS, a physical device, Windows and Linux are carried forward and none
of them blocks the epic. `make verify` is headless and boots no browser.

## Stories

- **The injection root** — `lib/app/injection.dart` registers `ApiConfig`, `KanthordApi`, the token
  provider and the base URL provider. It is the one file that names a concrete type.
- **The token providers** — `SecureStorageTokenProvider` and `MemoryTokenProvider`, selected by
  `kIsWeb` at the registration site, never inside the SDK.
- **The base URL store** — `PreferencesBaseUrlProvider implements BaseUrlProviderType`. Because
  `ApiConfig` reads the provider per request, replacing the value needs no new `KanthordApi` and no
  re-registration. This is the decision EPIC 003 depends on.
- **The desktop-first check** — every page this epic renders is verified at `expanded` first, in the
  browser, then at `wide` and `mobile`. Read `AGENTS.md` and `DESIGNS.md`.
- **The router** — `lib/app/router.dart` with the boot route, the unauthorized route and the
  development gallery route. `make generate` writes the `go_router_builder` output and the result is
  committed.
- **The env classes and `.env.example`** — `envied` for the development base URL, which is
  `http://localhost:31415`, and nothing else. A test asserts no env key is named like a token, and a
  test asserts the value is read as a prefill rather than as a fallback when the store is empty.
- **The `lib` must not import `test` rule** — the `arch-check` addition and its self-test.
- **The platform posture** — the Android network security configuration and the iOS ATS entry, each
  permitting cleartext to any host in every variant, plus `scripts/platform-config-check.sh`. Whether
  each platform actually blocks a Dart socket is a device measurement and a `NEEDS-HUMAN:` item,
  never an assumption.
