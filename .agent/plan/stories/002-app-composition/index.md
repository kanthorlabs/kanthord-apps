# EPIC 002 — App composition — stories

Epic: `.agent/plan/epics/002-app-composition.md`
Prereq: EPIC 001 (sequence order). `lib/api/` must exist and answer `api.system.health()`.

After these eight Stories, `get_it` holds one `KanthordApi`, the token and the base URL have a store
each, `go_router` replaces `home: KDGalleryPage(...)`, and the two mobile targets declare the
cleartext permission.

## Dispatch order

Take the files in number order, `01` through `08`. The order is a compile order.

**The file order is not the EPIC bullet order.** The EPIC lists the injection root first, and the
injection root registers the two stores, so it cannot compile before them. The map:

| File | EPIC `## Stories` bullet              |
| ---- | ------------------------------------- |
| `01` | The token providers                   |
| `02` | The base URL store                    |
| `03` | The injection root                    |
| `04` | The router                            |
| `05` | The env classes and `.env.example`    |
| `06` | The `lib` must not import `test` rule |
| `07` | The platform posture                  |
| `08` | The desktop-first check               |

Four Stories carried a **human pre-step**, because `scripts/lane-check.sh` denies those files to
every role. **All four are satisfied. `/work` can start.**

- `06` is human-applied in full — `scripts/arch-check.sh` and `scripts/arch-check.test.sh`. Applied
  first, because `01` through `05` each verify `make arch-check`.
- `04` needed the `build.yaml` glob for `go_router_builder`. Applied at `build.yaml:21-25`.
- `05` needed `.env.example` at the repository root. `c127229` created it; the owner renamed its key
  to `KANTHORD_API_ENDPOINT` on 2026-08-10. Applied, one line.
- `07` needed the Android network security file, the two `AndroidManifest.xml` attributes and the iOS
  `NSAppTransportSecurity` entry. Applied. Only `scripts/platform-config-check.sh` is dispatchable,
  and it is Task 007.1.

`08` is verification only and needs no Task. `Makefile` is locked and its half of G6 already landed
in commit `365fb2c`.

`01`, `02` and `03` are a coupled chain: `03` registers the two implementations `01` and `02` write.
`03` and `04` are a coupled pair: `04` reads `getIt<BaseUrlStoreType>()` and
`getIt<ThemeModeController>()`, both registered by `03`.

## Stories

- `01` — `MemoryTokenProvider` and `SecureStorageTokenProvider` → `01-token-providers.md`
- `02` — `BaseUrlStoreType` and `PreferencesBaseUrlProvider` → `02-base-url-store.md`
- `03` — `injection.dart`, `ThemeModeController` and the new `main.dart` → `03-injection-root.md`
- `04` — `app_routes.dart`, `router.dart`, the two pages and the new `kanthord_app.dart` → `04-router.md`
- `05` — `lib/app/env/env.dart` and `.env.example` → `05-env-classes.md`
- `06` — the `arch-check` rule and its self-test → `06-lib-must-not-import-test.md`
- `07` — the cleartext posture and `scripts/platform-config-check.sh` → `07-platform-posture.md`
- `08` — the Chrome launch at three bands → `08-desktop-first-check.md`

## Proof coverage

| EPIC Proof marker            | Story |
| ---------------------------- | ----- |
| `PASS 002-G1-DI`             | `03`  |
| `PASS 002-G2-TOKEN-STORE`    | `01`  |
| `PASS 002-G3-BASE-URL-STORE` | `02`  |
| `PASS 002-G4-ROUTER`         | `04`  |
| `PASS 002-G4-NAVIGATION`     | `04`  |
| `PASS 002-G5-ENV`            | `05`  |
| `PASS 002-G6-DEV-HOST`       | `08`  |
| `PASS 002-G7-PLATFORM`       | `07`  |

`06` delivers no `PASS` marker. The EPIC lists the `lib` must not import `test` rule under
**Hermetic coverage required beyond the Proof**, and `PASS 002-G4-NAVIGATION` is the
`Navigator.push` grep that `scripts/arch-check.sh:70-71` already implements.

## Decisions this expansion makes

Four things are not named in the EPIC. Each is a decision taken at authoring time so that no
implementer decides at build time. **The owner approved all four on 2026-08-10.**

- **`BaseUrlStoreType`.** EPIC 001 fixed `BaseUrlProviderType.baseUrl()` as `Future<String>`,
  non-nullable, while EPIC 002 G3 needs an unset state and EPIC 003 G3 needs a write after a `200`.
  **Approved: the widening interface.** Amending the EPIC 001 contract to a nullable `baseUrl()` was
  rejected, because it pushes null handling into `BaseUrlInterceptor`, which EPIC 001 explicitly
  defers to EPIC 003.
- **`PreferencesBaseUrlProvider.baseUrl()` throws `StateError`.** It follows from the non-nullable
  return plus the ban on a default. **Approved as authored.** Read the Constraints of
  `02-base-url-store.md` for why it stays untyped rather than becoming an `ApiException`.
- **`ThemeModeController`, registered in `get_it`.** G1 does not list it. `KDGalleryPage` requires
  `onThemeModeChanged`, the value lives in `_KanthorDAppState` today, and a generated typed route
  builder is static and captures no widget state. The alternatives are to drop the gallery toggle or
  to drop the gallery route, and both were rejected. **Approved.** It is app-lifetime and it is never
  disposed, which is correct for a singleton that outlives every route.
- **The `build.yaml` glob.** Enabling configuration rather than product scope: without it G4 cannot
  compile at the location G4 names.

## Test specification form

Every `test/**` file in these Stories appears **verbatim**, imports and `setUp` included. The
implementer copies the file and changes nothing. This differs from the EPIC 001 Stories, which give
an assertion list, and the owner chose the verbatim form on 2026-08-10 so that no import, matcher,
pump order or teardown is decided at build time.

Stories `06`, `07` and `08` carry no Dart test: `06` and `07` are shell, and `08` is verification
only.

## Facts (needed for implementation)

- **`lib/app/` holds one file today**, `kanthord_app.dart`. `lib/api/`, `lib/features/`,
  `lib/gen/` and `lib/app/env/` do not exist. `test/` holds `test/libraries/` only, so `test/app/`
  is new.
- **`build.yaml:21-25`** now runs `go_router_builder` over `lib/app/**_routes.dart` and
  `lib/features/**_routes.dart`. Before the applied pre-step it named `lib/features/` alone, and a
  `@TypedGoRoute` under `lib/app/` generated nothing. `build.yaml:26-29` points `envied_generator`
  at `lib/app/env/**.dart`, and it always did.
- **`scripts/lane-check.sh` lane table**: `test/**` and `integration_test/**` are the test-engineer;
  `lib/**`, `assets/**` and `scripts/**` are the software-engineer. Every other path is denied to
  every role, including `Makefile`, `build.yaml`, `android/**`, `ios/**`, `scripts/arch-check.sh`,
  `scripts/*.test.sh` and the repository root.
- **`scripts/arch-check.sh:88-89` bans a comment in `lib/(api|features)/` only.** `lib/app/` is
  outside that filter, and CLAUDE.md still forbids the comment.
- **`scripts/arch-check.sh:70-71` already bans `Navigator.push`.** G4 needs no new navigation rule.
- **Generated output is exempt from `arch-check`** through the `find` filter at
  `scripts/arch-check.sh:25-29`. The `$BootRoute` mixin `go_router_builder` writes contains
  `context.pushReplacement`, and it is never scanned.
- **`go_router_builder` 4.4.0 emits `mixin $<Name> on GoRouteData`** and one top-level
  `List<RouteBase> get $appRoutes` per annotated file. EPIC 002 declares one such file, so there is
  one `$appRoutes`. EPIC 003 adds its routes to the same file or it produces a second, conflicting
  symbol.
- **`KANTHORD_API_ENDPOINT` is the one env key name for every environment file.** `.env.example`
  carries the development value; `.env.staging` and `.env.production` carry their own endpoint under
  the same key, and a later EPIC adds the class that reads each. This EPIC ships the development
  class alone.
- **`@Envied` points at `.env.example`, the committed file, never at `.env`.** `.env` is gitignored
  and per-developer, so a generator pointed at it makes the committed `env.g.dart` differ per clone
  and breaks `test/app/env_test.dart` for anyone holding a different value. `envied` 1.3.8 defaults
  `requireEnvFile` to `false` and `EnviedField.defaultValue` fills a missing key, so the default is
  a second guard, not the mechanism.
- **`FlutterSecureStorage.setMockInitialValues(<String, String>{})`** exists at
  `flutter_secure_storage` 10.3.1 and replaces `FlutterSecureStoragePlatform.instance` with an
  in-memory implementation. It is the hermetic seam. No method-channel handler is needed.
- **`SharedPreferences.setMockInitialValues(<String, Object>{})`** exists at `shared_preferences`
  2.5.5 through the legacy API. `SharedPreferences.getInstance()` is the matching read.
- **`BaseUrlProviderType.baseUrl()` returns `Future<String>`**, non-nullable, fixed by EPIC 001
  Story 02. The unset case therefore needs a second method. `BaseUrlStoreType` adds
  `read()`/`save()`/`clear()` on top, and `baseUrl()` throws `StateError` when the key is absent.
  EPIC 003 G3 takes `BaseUrlStoreType`, because it writes after a `200`.
- **`KDGalleryPage` requires `onThemeModeChanged`** at
  `lib/libraries/kd_design_system/gallery/kd_gallery_page.dart:22`. The theme mode lives in
  `_KanthorDAppState` today, and a typed route builder is static, so `ThemeModeController` moves the
  value into `get_it` and keeps the toggle working.
- **`DESIGNS.md:110` assigns `KDFullScreenLayout` to the connect, unauthorized, boot and unreachable
  screens.** Both pages of Story 04 use it with `KDStatusView`.
- **`KDStatusView` takes `kind`, `title`, `message` and `actions`**, and `KDStatusKind` has
  `loading`, `error`, `empty` and `notImplemented`
  (`lib/libraries/kd_design_system/layout/kd_status_view.dart:7-21`).
- **`Makefile:148` and `Makefile:152`** already satisfy the G6 greps. Commit `365fb2c` landed them.
- **`.gitignore:17-18`** already reads `.env*` then `!.env.example`.
- **`make verify` is not the EPIC Proof.** `Makefile:125` expands it to `format-check analyze
arch-check test pipeline-test`, and every one of those passes at the end of every Story. The EPIC
  `Proof:` block is the aggregate, it names files later Stories create, and it runs one time at the
  end. A Story `Verify` section asks for `make verify` plus its own Proof line, never the whole
  block.
- **`make generate` is forbidden to both roles.** The software-engineer runs `make generate-lib`,
  the test-engineer runs `make generate-test`, and the generated files are committed.
