# EPIC 002 — App composition — stories

Epic: `.agent/plan/epics/002-app-composition.md`
Prereq: EPIC 001 and EPIC 001.1 (sequence order). `lib/api/` must exist, answer `api.system.health()`,
and carry `DaemonEndpoint`, `endpoint()`, `tokenOf(id)` and the pinning interceptors.

After these ten Stories, `get_it` holds one `KanthordApi`, `shared_preferences` holds a registry of
named daemons with one selected, each daemon's token sits in its own credential entry, `go_router`
replaces `home: KDGalleryPage(...)`, and the two mobile targets declare the cleartext permission.

## Dispatch order

Take the files in number order, `01` through `10`. The order is a compile order, so no Story
references a symbol a later Story creates.

**The file order is not the EPIC bullet order.** The map:

| File | EPIC `## Stories` bullet              |
| ---- | ------------------------------------- |
| `01` | The `lib` must not import `test` rule |
| `02` | The env classes and `.env.example`    |
| `03` | The `Daemon` model                    |
| `04` | The credential store                  |
| `05` | The daemon registry                   |
| `06` | The selected-daemon provider          |
| `07` | The injection root                    |
| `08` | The router                            |
| `09` | The platform posture                  |
| `10` | The desktop-first check               |

Three deviations from the bullet order are forced:

- `01` is first because Stories `02` through `09` each verify `make arch-check` over the enlarged rule
  set.
- `02` is second because the G5 registry seed in `05` imports `Env.apiEndpoint`.
- `10` is last because it verifies the pages `08` renders. The EPIC lists it sixth.

Coupled chains:

- `03` → `05`: the registry persists a JSON list of `Daemon`.
- `04` → `05`: `remove(id)` deletes the daemon's credential, which is G6.
- `04` + `05` → `06`: the provider reads both.
- `06` → `07`: the injection root registers the one provider instance under two interfaces.
- `07` → `08`: `BootPage` reads `getIt<DaemonRegistryType>()`, and `KanthorDApp` reads
  `getIt<ThemeModeController>()`.

## Human pre-steps

Four paths are denied to every role by `scripts/lane-check.sh`, so the human applies them.

| Pre-step                                                                                                            | Story | State                                |
| ------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------ |
| `scripts/arch-check.sh` + `scripts/arch-check.test.sh`, the lib/test rule                                           | `01`  | **APPLIED** at `:73-75` and `:60-63` |
| `.env.example` at the repository root, key `KANTHORD_API_ENDPOINT`                                                  | `02`  | **APPLIED**, one line                |
| `build.yaml` — the `freezed` and `json_serializable` globs for `lib/app/settings/**.dart`                           | `03`  | **APPLIED** at `:11-12` and `:16-17` |
| `build.yaml` — the `go_router_builder` glob for `lib/app/**_routes.dart`                                            | `08`  | **APPLIED** at `:21-25`              |
| The Android network security file, the two `AndroidManifest.xml` attributes, the iOS `NSAppTransportSecurity` entry | `09`  | **APPLIED**                          |

**Every pre-step is applied. `/work` can start.** `build.yaml:11-12` and `:16-17` now carry
`- lib/app/settings/**.dart` under `freezed` and under `json_serializable`, so `make generate-lib`
writes `daemon.freezed.dart` and `daemon.g.dart` and Story `03` compiles. No `options:` value changed.

`10` is verification only and needs no Task. `09` dispatches one Task, `scripts/platform-config-check.sh`.
`01` dispatches none.

## Stories

- `01` — the `arch-check` rule and its self-test, both already on disk → `01-lib-must-not-import-test.md`
- `02` — `lib/app/env/env.dart` over the committed `.env.example` → `02-env-classes.md`
- `03` — `Daemon`, `@freezed` plus `@JsonSerializable` → `03-daemon-model.md`
- `04` — `DaemonCredentialStoreType` and the memory and secure-storage stores → `04-credential-store.md`
- `05` — `DaemonRegistryType` and `PreferencesDaemonRegistry` → `05-daemon-registry.md`
- `06` — `SelectedDaemonProvider` under both provider interfaces → `06-selected-daemon-provider.md`
- `07` — `injection.dart`, `ThemeModeController` and the new `main.dart` → `07-injection-root.md`
- `08` — `app_routes.dart`, `router.dart`, the two pages and the new `kanthord_app.dart` → `08-router.md`
- `09` — the cleartext posture and `scripts/platform-config-check.sh` → `09-platform-posture.md`
- `10` — the Chrome launch at three bands → `10-desktop-first-check.md`

## Proof coverage

| EPIC Proof marker         | Story |
| ------------------------- | ----- |
| `PASS 002-G1-DI`          | `07`  |
| `PASS 002-G2-CREDENTIALS` | `04`  |
| `PASS 002-G3-REGISTRY`    | `05`  |
| `PASS 002-G4-UNSELECTED`  | `05`  |
| `PASS 002-G5-SEED`        | `05`  |
| `PASS 002-G6-REMOVE`      | `05`  |
| `PASS 002-G7-ROUTER`      | `08`  |
| `PASS 002-G7-NAVIGATION`  | `08`  |
| `PASS 002-G8-ENV`         | `02`  |
| `PASS 002-G9-DEV-HOST`    | `10`  |
| `PASS 002-G10-PLATFORM`   | `09`  |

`01`, `03` and `06` deliver no `PASS` marker of their own.

- `01` is listed under **Hermetic coverage required beyond the Proof**, and both edits are already on
  disk.
- `03` and `06` land under `PASS 002-G3-REGISTRY`, because that marker runs
  `make test-one T=test/app/settings`, which is the whole directory: `daemon_test.dart`,
  `selected_daemon_provider_test.dart` and the four registry files all run inside it.

## Decisions this expansion makes

Six things the EPIC does not name. Each is fixed here so no implementer decides at build time.
**The owner approved all six on 2026-08-10.**

- **The seed method is `DaemonRegistryType.seedDefault()`.** G3 lists seven members and G5 describes
  the seed without naming it. `seedDefault` matches the archived amendment that `main()` awaits.
- **The id rule is `d<n>`, one above the highest `d<digits>` already in the list.** G3 requires an
  opaque, registry-generated, never-changing id; the EPIC bans a new dependency, so `uuid` is out. The
  rule is a pure function of the stored list, so it needs no third preferences key and the same input
  always yields the same id.
- **`baseUrl()` answers `''` when nothing is selected.** The EPIC 001 contract is non-nullable and the
  scalar draft's `StateError` is withdrawn. `''` matches `_UnselectedBaseUrlProvider` in EPIC 001.1
  Story 04, and `BaseUrlInterceptor` never calls `baseUrl()` — it calls `endpoint()` once per request
  and rejects a `null` with `ApiNotConfiguredException`.
- **`SelectedDaemonProvider.save(token)` and `.clear()` act on the selected daemon and no-op when
  nothing is selected.** Both members come from the EPIC 001 `TokenProviderType` and neither may throw
  under G4. EPIC 003 and EPIC 003.1 write a credential through `DaemonCredentialStoreType` with an
  explicit id instead.
- **`remove(id)` clears `kanthord.selected_daemon_id` when the removed id was selected**, and
  `selected()` answers `null` on a stale id besides. G4 names both routes to the unselected state, so
  both are implemented.
- **`ThemeModeController`, registered in `get_it`.** G1 does not list it. G7 keeps the development
  gallery route, `KDGalleryPage` requires `onThemeModeChanged` at
  `lib/libraries/kd_design_system/gallery/kd_gallery_page.dart:22`, and a generated typed route builder
  is static and captures no widget state. It is app-lifetime and never disposed, which is correct for a
  singleton that outlives every route.

## Test specification form

Every `test/**` file in these Stories appears **verbatim**, imports and `setUp` included. The
implementer copies the file and changes nothing, so no import, matcher, pump order or teardown is
decided at build time.

`01`, `09` and `10` carry no Dart test: `01` and `09` are shell, and `10` is verification only.

## Facts (needed for implementation)

- **`lib/app/` holds one file today**, `lib/app/kanthord_app.dart` (26 lines), and `lib/main.dart`
  holds a synchronous seven-line `main()`. `lib/app/env/`, `lib/app/settings/`, `lib/app/token/`,
  `lib/app/pages/`, `lib/features/` and `lib/gen/` do not exist. `test/` holds `test/api/` and
  `test/libraries/` only, so `test/app/` is new.
- **The post-EPIC-001.1 contracts are the ones to implement against.** After EPIC 001.1 Story 02,
  `BaseUrlProviderType` is `Future<String> baseUrl()` plus `Future<DaemonEndpoint?> endpoint()`, and
  `TokenProviderType` is `Future<String?> token()`, `Future<String?> tokenOf(String daemonId)`,
  `Future<void> save(String token)` and `Future<void> clear()`. On disk today the two files still hold
  the narrower EPIC 001 shape at `lib/api/base_url_provider.dart:1-3` and
  `lib/api/token_provider.dart:1-5`. **Do not start EPIC 002 before EPIC 001.1 lands.**
- **`DaemonEndpoint` carries `id`, `name`, `baseUrl` and nothing else** (EPIC 001.1 Story 01). It has
  no `confirmedAt`, so `SelectedDaemonProvider.endpoint()` drops that field. `kDaemonIdKey` is
  `'kanthord.daemonId'` and `kCandidateDaemonId` is `'kanthord.candidate'`.
- **`ApiConfig` takes one required named parameter**, `BaseUrlProviderType baseUrlProvider`
  (`lib/api/api_config.dart:10`), and gains `Future<DaemonEndpoint?> endpoint()` in EPIC 001.1.
- **`KanthordApi` takes `config`, `tokens` and an optional `Dio`** (`lib/api/kanthord_api.dart:10`) and
  exposes one resource group, `system` (`:24`).
- **`build.yaml:11-12` and `:16-17` now include `lib/app/settings/**.dart`** under `freezed` and under
  `json_serializable`, which is what lets `Daemon` generate. `build.yaml:22-26` covers
  `go_router_builder` for `lib/app/**_routes.dart` and `lib/features/**_routes.dart`, and
  `build.yaml:27-30` covers `envied_generator` for `lib/app/env/**.dart`.
- **`json_serializable` runs with `explicit_to_json: true`, `create_to_json: true` and
  `include_if_null: false`** (`build.yaml:17-20`). The last one omits a null `confirmedAt` from the
  persisted JSON.
- **The `freezed` 3.2.5 idiom in this repository is `@freezed abstract class X with _$X`** plus a
  `const factory` and `@JsonKey(name:)` on every field. Mirror `lib/api/models/migration.dart:6-16`.
- **`scripts/arch-check.sh:73-75` already bans a `lib/**` file importing `test/**`**, and
  `scripts/arch-check.test.sh:60-63` already covers both quote styles. Story `01` writes nothing.
- **`scripts/arch-check.sh:70-71` already bans `Navigator.push`**, `pushNamed`, `pushReplacement` and
  `of(context).push`. G7 needs no new navigation rule.
- **`scripts/arch-check.sh:88-89` bans a comment in `lib/(api|features)/` only.** `lib/app/` is outside
  that filter, and CLAUDE.md still forbids the comment.
- **Generated output is exempt from `arch-check`** through the `find` filter at
  `scripts/arch-check.sh:25-29`. The `$BootRoute` mixin contains `context.pushReplacement` and is never
  scanned.
- **`scripts/lane-check.sh` lane table**: `test/**` and `integration_test/**` are the test-engineer
  (`:77-79`); `lib/**`, `assets/**` and `scripts/**` are the software-engineer (`:81-88`). Every other
  path is denied to every role (`:35-53`), `Makefile`, `build.yaml`, `pubspec.yaml`, `android/**`,
  `ios/**`, `docs/**`, `scripts/arch-check.sh` and `scripts/*.test.sh` included.
- **`make verify` is not the EPIC Proof.** `Makefile:129` expands it to
  `format-check analyze arch-check test pipeline-test`, and every one of those passes at the end of
  every Story. A Story `Verify` section asks for `make verify` plus its own Proof line, never the whole
  block.
- **`make pipeline-test` runs four self-tests** (`Makefile:123-127`): `lane-check.test.sh`,
  `turn-snapshot.test.sh`, `memory-append-only.test.sh` and `arch-check.test.sh`. A new
  `scripts/*.test.sh` would be neither writable nor run.
- **`make generate` is forbidden to both roles.** The software-engineer runs `make generate-lib`, the
  test-engineer runs `make generate-test`, and the generated files are committed.
- **`SharedPreferences.setMockInitialValues(<String, Object>{})`** exists at `shared_preferences` 2.5.5
  on the legacy API, and `SharedPreferences.getInstance()` is the matching read on the same class. It
  swaps `SharedPreferencesStorePlatform.instance` for an in-memory store and nulls the singleton
  completer. `SharedPreferencesAsync` has no such method and is not used here.
- **`FlutterSecureStorage.setMockInitialValues(<String, String>{})`** exists at
  `flutter_secure_storage` 10.3.1 and replaces `FlutterSecureStoragePlatform.instance` with the
  in-memory double the package ships. No method-channel handler is needed.
- **`FlutterSecureStorage.read`, `.write` and `.delete` take `key` as a named required parameter.**
  Never positional. `write` takes `required String? value`, and a null value routes to a delete.
- **`go_router_builder` 4.4.0 emits `mixin $<Name> on GoRouteData`** and one top-level
  `List<RouteBase> get $appRoutes` **per annotated library**. It throws `Missing mixin clause` when the
  annotated class omits `with $<Name>`. EPIC 002 declares one such library, `lib/app/app_routes.dart`.
  A later EPIC declares its own under `lib/features/<name>/<name>_routes.dart`, and the two
  `$appRoutes` getters do **not** conflict: each is a member of its own library, and
  `lib/app/router.dart` imports each under a prefix and spreads both. Story `08` therefore imports
  `app_routes.dart` as `app` in both `lib/app/router.dart` and `test/app/router_test.dart`, so a later
  EPIC adds one prefixed import and one spread and rewrites no existing reference.
- **`envied` 1.3.8 defaults `requireEnvFile` to `false`**, and `EnviedField.defaultValue` fills a
  missing key with a `String`, `bool` or `num`. `@Envied(path:)` defaults to `.env`, so the path must be
  named explicitly.
- **`@Envied` points at `.env.example`, the committed file, never at `.env`.** `.env` is gitignored
  (`.gitignore:17-18`) and per-developer, so a generator pointed at it makes the committed `env.g.dart`
  differ per clone.
- **`KANTHORD_API_ENDPOINT` is the one env key name for every environment file.** `.env.example` carries
  `http://localhost:31415`. `.env.staging` and `.env.production` carry their own endpoint under the same
  key, and a later EPIC adds the class that reads each. This EPIC ships the development class alone.
- **`KDGalleryPage` requires `onThemeModeChanged`**, a `ValueChanged<ThemeMode>`, at
  `lib/libraries/kd_design_system/gallery/kd_gallery_page.dart:22`. It is the only required parameter.
  The value lives in `_KanthorDAppState` today (`lib/app/kanthord_app.dart:14`, one `setState` at
  `:23`).
- **`KDStatusView` takes `kind`, `title`, `message` and `actions`**
  (`lib/libraries/kd_design_system/layout/kd_status_view.dart:10-16`); only `kind` and `title` are
  required. `KDStatusKind` is `loading`, `error`, `empty`, `notImplemented` (`:7`).
- **`KDFullScreenLayout` requires `child` alone**
  (`lib/libraries/kd_design_system/layout/kd_full_screen_layout.dart:8-14`).
- **`DESIGNS.md:110` assigns `KDFullScreenLayout` to the connect, unauthorized, boot and unreachable
  screens.** Both pages of Story `08` use it with `KDStatusView`.
- **A page imports the `KD` leaf file, never the barrel.** No file in `lib/` or `test/` imports
  `kd_design_system.dart`. `lib/app/kanthord_app.dart:3-4` is the pattern for `lib/`, and
  `test/libraries/kd_design_system/layout/kd_full_screen_layout_test.dart:3` is the pattern for
  `test/`.
- **The widget-test surface convention is a private `_pumpAt`-style helper** that sets
  `tester.view.devicePixelRatio`, `tester.view.physicalSize` and `addTearDown(tester.view.reset)`
  before the first `pumpWidget` (`docs/testing.md:122-128`). There is no shared wrapper.
- **`test/api/` uses no `setUp`.** These Stories do, because `SharedPreferences`,
  `FlutterSecureStorage` and `getIt` each need a per-test reset. `docs/testing.md` states no rule
  against it.
- **`docs/testing.md:41-51` says to mock a store and never `KanthordApi`.** It names
  `DaemonRegistryType` and `DaemonCredentialStoreType` as correct fake or `mockito` targets. These
  Stories use hand-written fakes and the two real in-memory stores, so they add no
  `@GenerateMocks` and run no `make generate-test`.
- **`Makefile:36` pins `WEB_PORT ?= 8080`**, `:152` is `dev: run-web`, and `:156` carries
  `--web-port=$(WEB_PORT)`. Both G9 greps already answer 0.
- **`scripts/platform-config-check.sh` does not exist.** It is the one dispatchable Task of Story `09`.
- **The Android and iOS cleartext files are on disk**:
  `android/app/src/main/res/xml/network_security_config.xml:3` holds
  `<base-config cleartextTrafficPermitted="true" />`, `android/app/src/main/AndroidManifest.xml:6-7`
  holds both attributes, and `ios/Runner/Info.plist:69-73` holds `NSAppTransportSecurity` with
  `NSAllowsArbitraryLoads` set to `<true/>`. The debug and profile manifests carry neither attribute,
  which is correct.
- **No new dependency.** `get_it` 9.2.1, `go_router` 17.4.0, `shared_preferences` 2.5.5,
  `flutter_secure_storage` 10.3.1, `envied` 1.3.8, `freezed_annotation` 3.1.0 and `json_annotation`
  4.12.0 are in `pubspec.yaml` already.
