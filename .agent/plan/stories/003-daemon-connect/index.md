# EPIC 003 — `daemon_connect` — stories

Epic: `.agent/plan/epics/003-daemon-connect.md`
Prereq: EPIC 001, EPIC 001.1 and EPIC 002 (sequence order). `get_it` must hold `KanthordApi`,
`DaemonRegistryType` and `DaemonCredentialStoreType`; `KanthordApi` must carry `withCandidate` and
`adapterFactory`; `go_router` must already replace `home: KDGalleryPage(...)`.

After these nine Stories the human sees the selected daemon by name, edits its base URL and its
token, presses one button, and the client proves the pair against `GET /v1/health` before it stores
either value.

Re-authored on 2026-08-10. The first expansion was written against `BaseUrlStoreType`, a scalar token
store and `ProbeClientBuilder`. All three are gone. The superseded expansion is at
`.agent/plan/stories/003-daemon-connect.superseded-2026-08-10/`.

## The EPIC 002 contract this EPIC consumes

**Confirmed against the EPIC 002 expansion on 2026-08-10.** EPIC 002 owns these signatures.
Stories 04, 08 and 09 cite them; no other Story touches a store.

```dart
@freezed
abstract class Daemon with _$Daemon {
  const factory Daemon({
    @JsonKey(name: 'id') required String id,
    @JsonKey(name: 'name') required String name,
    @JsonKey(name: 'baseUrl') required String baseUrl,
    @JsonKey(name: 'confirmedAt') DateTime? confirmedAt,
  }) = _Daemon;

  factory Daemon.fromJson(Map<String, dynamic> json) => _$DaemonFromJson(json);
}

abstract class DaemonRegistryType {
  Future<List<Daemon>> list();
  Future<Daemon> add({required String name, required String baseUrl});
  Future<void> update(Daemon daemon);
  Future<void> remove(String id);
  Future<void> select(String id);
  Future<String?> selectedId();
  Future<Daemon?> selected();
  Future<void> seedDefault();
}

abstract class DaemonCredentialStoreType {
  Future<String?> read(String daemonId);
  Future<void> save(String daemonId, String token);
  Future<void> delete(String daemonId);
}
```

**`DaemonRegistryType` has eight members.** `seedDefault()` is the eighth and `main()` awaits it.
`FakeDaemonRegistry` in Story 04 implements all eight, or it does not compile.

`daemonId` is **positional** on every `DaemonCredentialStoreType` member, and `add` takes **named**
parameters and returns the created `Daemon`.

`confirmedAt` is the one nullable field. `build.yaml` sets `include_if_null: false`, so a null
`confirmedAt` is omitted from the persisted JSON. No Story here asserts the key with a null value; the
two Stories that read it assert the Dart field is `null` through `registry.selected()`.

Confirmed file paths, cited by the imports of Stories 04 and 09:

| Symbol                      | Path                                         |
| --------------------------- | -------------------------------------------- |
| `Daemon`                    | `lib/app/settings/daemon.dart`               |
| `DaemonRegistryType`        | `lib/app/settings/daemon_registry.dart`      |
| `DaemonCredentialStoreType` | `lib/app/token/daemon_credential_store.dart` |
| `getIt`                     | `lib/app/injection.dart`                     |

**This EPIC uses five members and no more:** `selected()`, `update(daemon)`, `read(id)`, `save(id,
token)` and `delete(id)`. `add` appears one time, in Story 09 Edit 4, inside a router test. `list`,
`remove`, `select`, `selectedId` and `seedDefault` are never called by this EPIC — `seedDefault` is
`main()`'s, and the other four are EPIC 003.1's.

**The token write goes through `DaemonCredentialStoreType` with an explicit id, never through
`TokenProviderType.save`.** `SelectedDaemonProvider.save` acts on whatever is selected at the moment
it runs, which is not the identity the probe proved. Story 04 writes `credentials.save(daemonId,
token)`.

**EPIC 002 numbers its Stories in compile order**, which is not this EPIC's numbering and not the
EPIC 002 bullet order. Nothing here cites an EPIC 002 Story number, so that numbering is free to
change.

**This EPIC is the only writer of `confirmedAt`.** The registry seed leaves it `null` (EPIC 002 G5)
and a `200` from `GET /v1/health` sets it (Story 04).

## Dispatch order

Take the files in number order, `01` through `09`. The order is a compile order, and it is **not**
the EPIC bullet order: the EPIC lists the routes first, and the routes create the bloc, which needs
the page, which needs the state.

| File | EPIC `## Stories` bullet |
| ---- | ------------------------ |
| `01` | `ConnectState`           |
| `02` | The probe outcome map    |
| `03` | The cleartext warning    |
| `04` | The candidate probe      |
| `05` | The health view          |
| `06` | The unauthorized state   |
| `07` | The settings destination |
| `08` | The connect page         |
| `09` | The routes               |

Coupled pairs:

- `01` and `02` — `probeFailure` returns the three failure variants `01` declares, and it takes the
  `ConnectTarget` `01` declares.
- `04` and `01`/`02`/`03` — the bloc emits every variant, calls `probeFailure` and guards on
  `isUsableBaseUrl`.
- `08` and `03`/`04`/`05`/`06`/`07` — the page composes all five, and it imports the fakes `04`
  writes.
- `09` and `08`/`04` — the route creates the bloc and renders the page.

`03`, `05`, `06` and `07` have no dependency on each other and may run in any order between `04` and
`08`. `05`, `06` and `07` do not depend on `04` either: none of them reads a store.

## Stories

- `01` — `ConnectTarget`, `ConnectState`, `targetOf` → `01-connect-state.md`
- `02` — `probeFailure`, the outcome truth table → `02-probe-outcome.md`
- `03` — `isCleartextRisk` and `isUsableBaseUrl`, the two URL rules → `03-cleartext-warning.md`
- `04` — `ConnectEvent`, `ConnectBloc`, the shared test fakes → `04-candidate-probe.md`
- `05` — `HealthView` → `05-health-view.md`
- `06` — `UnauthorizedNotice` → `06-unauthorized-notice.md`
- `07` — `SettingsValues`, `SettingsDialog` → `07-settings-dialog.md`
- `08` — `ConnectPage` → `08-connect-page.md`
- `09` — `ConnectRoute`, the splash entrypoint and the two-library router → `09-routes.md`

## Proof coverage

| EPIC Proof marker           | Story                                         |
| --------------------------- | --------------------------------------------- |
| `PASS 003-G2-BLOC`          | `04`                                          |
| `PASS 003-G3-CANDIDATE`     | `04`                                          |
| `PASS 003-G4-OUTCOMES`      | `02`                                          |
| `PASS 003-G5-WEB-MESSAGE`   | `02`                                          |
| `PASS 003-G6-CLEARTEXT`     | `03`                                          |
| `PASS 003-G7-HEALTH-RENDER` | `08`, and `05` covers the widget in isolation |
| `PASS 003-G8-SETTINGS`      | `07` and `08`                                 |
| `PASS 003-G1-MECHANICAL`    | `09`                                          |

`01` delivers no `PASS` marker. Every other Story consumes it.

Two Proof markers are completed beyond the named command, because the command does not prove what its
label claims:

- `PASS 003-G8-SETTINGS` runs the directory `test/features/daemon_connect/settings`. The dialog test
  alone proves only that the dialog returns values. Story `08` therefore adds
  `test/features/daemon_connect/settings/settings_flow_test.dart` in that directory, and it proves the
  credential is deleted, the page applies all three replacement values, the name and the base URL
  survive a token clear, and the unauthorized state shows the daemon name and the base URL without
  clearing anything.
- `PASS 003-G7-HEALTH-RENDER` runs `connect_page_test.dart` alone. Story `08` therefore uses a
  four-dependency `degraded` fixture and asserts the returned order, `not-implemented` and an unknown
  raw status inside that file. `05` keeps the same cases with the tone assertions.

`PASS 003-G4-OUTCOMES` covers the three failure outcomes only. The `200` outcome is proven by
`connect_bloc_test.dart` under `PASS 003-G2-BLOC`. That split is the EPIC's, and no Story can close it
without editing the EPIC Proof block.

The EPIC's **hermetic coverage** items land as follows.

| EPIC hermetic item                                               | Story and file                                                 |
| ---------------------------------------------------------------- | -------------------------------------------------------------- |
| A real `KanthordApi` over a mocked transport, no repository mock | `04`, `daemon_fakes.dart` `fakeApi` + `connect_bloc_test.dart` |
| A `401` leaves the stored token in place                         | `04`, `connect_candidate_test.dart`                            |
| A failed probe leaves `baseUrl` and `confirmedAt` in place       | `04`, `connect_candidate_test.dart`                            |
| The four outcomes asserted on the state, never on a string       | `02`                                                           |
| A half-failed commit restores the entry and the credential       | `04`, `connect_bloc_test.dart`, both write-failure tests       |

## Decisions this expansion makes

Each is taken at authoring time so that no implementer decides at build time.

- **`ConnectTarget` groups the four daemon values.** `daemonId`, `daemonName`, `baseUrl` and `token`
  travel as one `@freezed` object, and every daemon-bearing variant carries `required ConnectTarget
target`. **Owner decision, taken 2026-08-10.** An `unselected` variant carrying no field breaks the
  union accessors `state.baseUrl` and `state.token`, because `freezed` generates a shared getter only
  when every variant declares the field. `targetOf(ConnectState)` is the one switch that reads the
  union, and it lives in `connect_state.dart`.
- **`ConnectTarget` lives in `connect_state.dart`.** `build.yaml:12` runs `freezed` over
  `lib/features/**_state.dart`, so a separate `connect_target.dart` would generate nothing.
- **`probeFailure` takes the `ConnectTarget`, not two loose strings.** Its three failure variants each
  carry a target, so it cannot build one without the daemon identity. The truth table is unchanged
  from the superseded expansion; only the parameter list moved.
- **`confirmedAt` is injected.** `ConnectBloc` takes `DateTime Function() now = _systemNow`, and every
  test passes `() => DateTime.utc(2026, 8, 10)`. A handler that called `DateTime.now()` could not be
  asserted, so the suite would not be deterministic.
- **The commit is two awaited writes, not three.** `name`, `baseUrl` and `confirmedAt` travel in one
  `registry.update` call, and the credential is the second write. The EPIC delta describes three
  write targets; two of them share one call. `select` is never called, because the daemon is already
  selected.
- **The dialog returns three values and the page dispatches two events**, in a fixed order:
  `ConnectDaemonEdited(name:, baseUrl:)` then the token event. The name and the base URL therefore
  land even when the token event is a clear.
- **The unselected page renders no `Settings` footer.** With no daemon there is nothing for the dialog
  to edit. Adding a daemon is EPIC 003.1.
- **`10.0.2.2` warns.** It is not a loopback address, and `isCleartextRisk` receives a URL with no
  platform context, so it cannot know an emulator typed it. `docs/api/auth.md:94-99`.
- **Three failure variants, not four.** G4 names four outcomes and covers `200`, `401`, `403` and a
  connection failure. It covers no `5xx`, no timeout and no decode failure. Those fall to
  `ConnectUnreachable`, and `02` writes the whole truth table, `ApiNotConfiguredException` included.
- **`origin-forbidden` gets its operator message in the feature, and it claims no value.** The SDK
  rewrites `host-forbidden` only (`lib/api/api_exception.dart:66-76`). `probeFailure` branches on
  `code` and picks the config key. The two keys take **different values**: `host-forbidden` wants the
  daemon host the client sent, and `origin-forbidden` wants the page origin such as
  `http://localhost:8080` (`docs/api/connectivity.md:121-128`). Story `08` renders two sentences and
  never tells the operator to add the daemon host to `KANTHORD_HTTP_ALLOWED_ORIGINS`.
- **The scheme does not exempt the cleartext warning.** The rule is exactly the one G6 states: a host
  that is not loopback warns, `https` included. The daemon serves plain HTTP and ships no certificate
  handling, so an `https` base URL is a mistake rather than a safe path.
- **A storage failure is its own state.** `ConnectStorageFailed` reports that the daemon answered
  `200` and the client then failed to persist. It is not a probe outcome, `probeFailure` never returns
  it, and the commit restores the previous entry and the previous credential before it is emitted.
- **An unusable base URL blocks the probe.** `isUsableBaseUrl` gates the `Connect` button and guards
  the bloc handler, so a value that is not `http`/`https` with a host never reaches `Dio`.
- **No settings route and no unauthorized route.** `KDDialog` already branches full screen below `600`
  and dialog above, so the settings destination is `KDDialog.show` over the connect page and needs no
  route with an invented scrim. The unauthorized state is a `ConnectState` variant. The feature
  declares one route, `/connect`.
- **`/` is the splash entrypoint and it holds every routing condition.** Story `09` turns EPIC 002's
  `BootPage` into that page: it renders a loading `KDStatusView` and resolves one destination,
  `/connect`. `lib/app/app_routes.dart` is untouched and no EPIC 002 file is deleted.

## Owner decisions that were open and are now closed

- **B1 — `KanthordApi` and `SystemResource` are `final class`, so neither can be mocked. CLOSED.**
  `docs/testing.md:43-47` now says to mock the transport and names `test/api/dio_mock_adapter.dart`,
  and `:62-64` names `adapterFactory` as the seam for code that builds its own candidate. No Story
  uses `mockito`, and no Story runs `make generate-test`.
- **B2 — the bloc takes `ProbeClientBuilder`, not `KanthordApi`. CLOSED.** EPIC 001.1 G7 adds
  `KanthordApi.withCandidate`, so the bloc takes the registered client and still probes a candidate.
  `ProbeClientBuilder` and `candidate_client.dart` are deleted from the plan and are never written.
- **B3 — the routes. CLOSED.** The feature declares one route, `/connect`.
- **B4 — the entrypoint. CLOSED.** `/` is the splash page and it is the one place that holds routing
  conditions.

## Test specification form

Every `test/**` file appears **verbatim**, imports and `setUp` included. The implementer copies the
file and changes nothing. Story `09` is the one exception: it amends `test/app/router_test.dart`,
which EPIC 002 owns, so it gives five behavior-keyed edits and a COORDINATION block instead of line
anchors.

**No Story uses `mockito`.** Every hermetic seam is either `test/api/dio_mock_adapter.dart` under
`adapterFactory`, or a hand-written fake in `test/features/daemon_connect/daemon_fakes.dart`.

`daemon_fakes.dart` is the one place the EPIC 002 store contract is faked. Stories `04` and `08`
import it, so a contract change touches one file rather than four.

## Facts (needed for implementation)

- **`GET /v1/health` returns a bare object, not an envelope.** Only errors are enveloped. The roll-up
  field is `status` (`ok`, `degraded`), the list field is `dependencies`, and a dependency status is
  `ok`, `failed` or `not-implemented`
  (`docs/api/contract/features/system.yaml:451-480`, `docs/api/contract/examples/system.health.json`).
- **The error codes are literal strings.** `401 unauthenticated`, `403 origin-forbidden`,
  `403 host-forbidden` (`docs/api/errors.md:30-32`). Branch on `code`, never on `message` and never on
  the HTTP status (`docs/api/errors.md:18`).
- **The `403 host-forbidden` body carries no `details`**, so the client supplies the host itself from
  the base URL it sent.
- **`ApiException.fromDio` already rewrites `host-forbidden`** with the authority and
  `KANTHORD_HTTP_ALLOWED_HOSTS` (`lib/api/api_exception.dart:66-76`). It leaves `origin-forbidden`
  generic (`:77-82`).
- **The web opaque message is already built in the SDK** (`lib/api/api_exception.dart:22-32`) and it
  names the four causes and the two config keys. `ConnectUnreachable.detail` passes it through, and
  `isOpaque` records that the client cannot claim one cause. The collapse applies to
  `ApiNoNetworkException` alone.
- **`kApiIsWeb`** is `const bool kApiIsWeb = bool.fromEnvironment('dart.library.js_interop');`
  (`lib/api/api_platform.dart:1`). `ConnectBloc` takes it as a default argument so a test pins it.
- **`WireEnum` keeps the raw wire string** (`lib/api/models/wire_enum.dart:5-8`). `known` is `null`
  for an unknown value and `raw` always holds the server string, so `HealthView` renders `raw`.
- **`KanthordApi.withCandidate({required String baseUrl, required String token})` is an instance
  method** and it passes the parent's `adapterFactory` to the candidate (EPIC 001.1 G7 and G8). That
  is why a test puts `MockHttpClientAdapter` under the parent and reads the candidate's request off
  `adapter.requests`. The candidate owns its `Dio`, and the caller closes it.
- **`kDaemonIdKey == 'kanthord.daemonId'` and `kCandidateDaemonId == 'kanthord.candidate'**
(EPIC 001.1 Story 01). A candidate request carries the candidate id in `options.extra`, which
`connect_candidate_test.dart` asserts.
- **`test/api/dio_mock_adapter.dart` provides `MockHttpClientAdapter` and `jsonResponse`**, records
  every `RequestOptions` in `requests`, has a settable `respond` closure, and its `close` is a no-op.
  It is reachable from `test/features/daemon_connect/connect/` as `'../../../api/dio_mock_adapter.dart'`
  and from `test/features/daemon_connect/` as `'../../api/dio_mock_adapter.dart'`. It imports no
  `dart:io`.
- **`SystemResource.health()` takes no parameter and returns `Future<Health>`**
  (`lib/api/resources/system_resource.dart:15`).
- **`KDInputField` obscures with `isObscured`, errors with `error`, and builds its own reveal
  control** (`lib/libraries/kd_design_system/atoms/kd_input_field.dart:5-38`, `:60-67`). It asserts a
  `controller` **or** an `initialValue`, never both (`:19-22`). `KDButton` uses `isBusy` and
  `isEnabled`, and `isBusy: true` also blocks the press (`atoms/kd_button.dart:7-28`, `:94`).
- **`KDDialog.show<T>(context, builder:)`** is the static entry (`layout/kd_dialog.dart:27-38`), and
  `KDDialog` itself branches full screen below `600` and `Dialog` at `600` and above (`:118-128`). The
  caller never branches.
- **`KDFullScreenLayout` takes `child`, `showBrand`, `footer` and `maxContentWidth`**
  (`layout/kd_full_screen_layout.dart:7-19`). It has no header slot, so the daemon name is the first
  child of the column.
- **`KDStatusView` takes `kind`, `title`, `message` and `actions`**, and `KDStatusKind` is
  `loading`, `error`, `empty`, `notImplemented` (`layout/kd_status_view.dart:7-14`).
- **`KDTextRole` includes `titleMedium`, `titleSmall`, `bodyMedium`, `bodySmall` and `labelLarge`**
  (`styles/kd_text_styles.dart:4-19`). `KDTextTone` is `primary`, `secondary`, `error`, `onAccent`
  (`atoms/kd_text.dart:5`).
- **`KDCardList` is an unbounded `ListView`** (`organisms/kd_card_list.dart:25-35`) and overflows
  inside the `SingleChildScrollView` of `KDFullScreenLayout`. `HealthView` is a `Column` of `KDCard`.
- **Breakpoints are `kdWideBreakpoint = 600` and `kdExpandedBreakpoint = 840`**, read through
  `context.kdLayout` under a `KDLayout` ancestor (`layout/kd_layout.dart:5-6`, `:38-44`). Assert `599`
  and `600`, never `500` and `700` (`docs/testing.md:130-131`).
- **`context.kdTokens` is `Theme.of(this).extension<KDTokens>()!`**
  (`styles/kd_tokens.dart:235-237`). Any test that pumps a page must pass `theme: KDTheme.light()`, or
  the null assertion throws. `KDTheme.light()` and `KDTheme.dark()` take no argument
  (`styles/kd_theme.dart:7-10`).
- **`scripts/arch-check.sh:105-106` bans `Color(0x`, `Colors.<lowercase>`, `TextStyle(` and
  `BorderRadius.circular(<digit>)` under `^lib/features/`.** `BorderRadius.circular(tokens.radius.md)`
  passes. **`:88-89` bans every `//` and `///` comment under `lib/(api|features)/`.** **`:70-71` bans
  `Navigator.push`, `pushNamed`, `pushReplacement` and `of(context).push`, but not `pop`.** Generated
  files are excluded by the `find` filter at `:25-29`.
- **`scripts/lane-check.sh` lanes:** `test/**` is the test-engineer, `lib/**` and `scripts/**` are the
  software-engineer. `.agent/plan/*`, `docs/*`, `Makefile`, `build.yaml` and `pubspec.yaml` are denied
  to every role, so no Story here may edit any of them.
- **`go_router_builder` 4.4.0 emits one `$appRoutes` per annotated library.** Two annotated files
  therefore need two prefixed imports in `lib/app/router.dart`.
- **A `BlocConsumer` listener does not fire for the state that is already current at mount.**
  `ConnectPage` therefore seeds its two controllers in `didChangeDependencies` and uses the listener
  for later changes only.
- **`flutter_bloc` does not serialise handlers into a single flight.** `ConnectBloc` guards every
  handler with `if (state is ConnectProbing) return;`, so two presses send one request and an
  in-flight probe always commits the values it started with.
- **`make generate` is forbidden to both roles.** The software-engineer runs `make generate-lib`, the
  test-engineer runs `make generate-test`, and every generated file is committed. Only Stories `01`
  and `09` generate anything, and both are `make generate-lib`.
- **`make verify` is not the EPIC Proof.** `Makefile:129` expands it to
  `format-check analyze arch-check test pipeline-test`, and it passes at the end of every Story. The
  EPIC `Proof:` block names files later Stories create and runs one time at the end.
- **No EPIC 002 Proof marker is cited here.** The re-authored EPIC 002 runs `002-G1-DI` through
  `002-G10-PLATFORM`; the markers of the superseded expansion no longer exist.
