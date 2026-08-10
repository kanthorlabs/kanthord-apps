# EPIC 003 — `daemon_connect` — stories

Epic: `.agent/plan/epics/003-daemon-connect.md`
Prereq: EPIC 001.1 and EPIC 002 (sequence order). `get_it` must hold `KanthordApi`,
`DaemonRegistryType` and `DaemonCredentialStoreType`, `KanthordApi` must carry `withCandidate`, and
`go_router` must already replace `home: KDGalleryPage(...)`.

> **STOP — six of the nine Stories are SUPERSEDED and must be re-expanded before `/work` starts.**
>
> The owner decided on 2026-08-10 that the product holds **more than one daemon**, and answered B1
> and B2. Three contracts these Stories were written against no longer exist:
>
> - `BaseUrlStoreType` and the scalar token store are replaced by `DaemonRegistryType` and
>   `DaemonCredentialStoreType` (re-authored `.agent/plan/epics/002-app-composition.md`);
> - `ProbeClientBuilder` is replaced by `KanthordApi.withCandidate`
>   (`.agent/plan/epics/001.1-candidate-client-and-daemon-pinning.md` G7);
> - a screen acts on **the selected daemon**, which has an `id` and a `name`, not on a bare base URL.
>
> **`01`, `04`, `06`, `07`, `08` and `09` are superseded.** They are not re-expanded here, because a
> deterministic Story cannot cite a signature that does not exist yet: the EPIC 002 registry Stories
> and the EPIC 001.1 Stories are both unwritten. Re-run `/author` on EPIC 003 **after** EPIC 001.1 and
> the re-authored EPIC 002 are expanded, and use the delta specification below.
>
> **`02`, `03` and `05` stand unchanged.** `probeFailure`, `isCleartextRisk`, `isUsableBaseUrl` and
> `HealthView` read no store and know no daemon identity.
>
> ### Delta specification for the re-expansion
>
> - **`01` `ConnectState`** — every variant gains `daemonId` and `daemonName` beside `baseUrl` and
>   `token`. Add an `unselected` variant for EPIC 003 G9. `storageFailed` stays and now covers a
>   partial write across the registry, the selected id and the credential store.
> - **`04` the bloc** — the constructor takes `KanthordApi api`, `DaemonRegistryType registry`,
>   `DaemonCredentialStoreType credentials` and `bool isWeb`. The probe is
>   `api.withCandidate(baseUrl: ..., token: ...)`, and the candidate is closed in `finally`. The
>   commit is one ordered transaction over three writes — daemon entry, credential, `confirmedAt` —
>   with the previous entry and the previous credential captured first and restored on any failure.
>   `ProbeClientBuilder` and `lib/features/daemon_connect/connect/candidate_client.dart` are deleted.
>   The single-flight guard, the `isUsableBaseUrl` guard and the tests for both survive verbatim.
> - **`06` `UnauthorizedNotice`** — shows the daemon **name** and its base URL, so the operator knows
>   which of two daemons refused the token. It still clears nothing.
> - **`07` `SettingsDialog`** — returns `name`, `baseUrl` and `token` for the selected daemon. It gains
>   no list and no switcher; those are EPIC 003.1, which reuses this dialog as its surface.
> - **`08` `ConnectPage`** — renders the `unselected` state, carries the daemon name in the header, and
>   maps the dialog's three values back to events.
> - **`09` the routes** — `ConnectRoute` passes `getIt<KanthordApi>()`, `getIt<DaemonRegistryType>()`
>   and `getIt<DaemonCredentialStoreType>()`. The splash entrypoint and the two-library router are
>   unchanged.
>
> Everything below this block describes the superseded expansion. Read it for the parts that stand.

After these nine Stories the human types a base URL and a token, presses one button, and the client
proves the pair against `GET /v1/health` before it stores either value.

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

- `01` and `02` — `probeFailure` returns the three failure variants `01` declares.
- `04` and `01`/`02` — the bloc emits every variant and calls `probeFailure`.
- `08` and `03`/`05`/`06`/`07` — the page composes all four.
- `09` and `08` — the route creates the bloc and renders the page.

`03`, `05`, `06` and `07` have no dependency on each other and may run in any order between `04`
and `08`.

One **human pre-step** existed and is **applied**: `docs/testing.md` "What to mock" now says to mock
the transport rather than `KanthordApi`, because `KanthordApi` and `SystemResource` are `final class`.
`scripts/lane-check.sh:45` denies `docs/*` to every role, so no agent could make that edit.

Every other path these Stories touch is inside a role lane (`lib/**` for the software-engineer,
`test/**` for the test-engineer). `build.yaml:21-25` already runs `go_router_builder` over
`lib/features/**_routes.dart`, applied during EPIC 002.

## Stories

- `01` — `ConnectState`, the `@freezed` sealed class of seven variants → `01-connect-state.md`
- `02` — `probeFailure`, the outcome truth table → `02-probe-outcome.md`
- `03` — `isCleartextRisk` and `isUsableBaseUrl`, the two URL rules → `03-cleartext-warning.md`
- `04` — `CandidateBaseUrlProvider`, `CandidateTokenProvider`, `ConnectEvent`, `ConnectBloc` →
  `04-candidate-probe.md`
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

Two Proof markers were completed after the first draft, because the named command did not prove what
its label claims:

- `PASS 003-G8-SETTINGS` runs the directory `test/features/daemon_connect/settings`. The dialog test
  alone proves only that the dialog returns values. Story `08` therefore adds
  `test/features/daemon_connect/settings/settings_flow_test.dart` in that directory, and it proves
  the store is cleared, the page applies both replacement values, the base URL survives a token
  clear, and the unauthorized state shows the current base URL without clearing anything.
- `PASS 003-G7-HEALTH-RENDER` runs `connect_page_test.dart` alone. Story `08` therefore uses a
  four-dependency `degraded` fixture and asserts the returned order, `not-implemented` and an unknown
  raw status inside that file. `05` keeps the same cases with the tone assertions.

`PASS 003-G4-OUTCOMES` covers the three failure outcomes only. The `200` outcome is proven by
`connect_bloc_test.dart` under `PASS 003-G2-BLOC`. That split is the EPIC's, and no Story can close
it without editing the EPIC Proof block.

The EPIC's four **hermetic coverage** items land as follows. The bloc drives a real `KanthordApi`
over a mocked transport — the EPIC bullet and `docs/testing.md` were both amended on 2026-08-10 — and
mocks
no repository — `04`, `connect_bloc_test.dart`. A `401` leaves the stored token in place and a failed
probe leaves the stored base URL in place — `04`, `connect_candidate_test.dart`, which reads both
stores after the probe. The four outcomes are asserted on the state, never on a rendered string —
`02`.

## Owner decisions

**B3 and B4 are answered. B1 and B2 remain open, and `/work` must not start on Stories `04` and `08`
until the owner answers them.** The Stories are written to one deterministic answer each, so a
confirmation unblocks them with no rewrite.

- **B1 — `KanthordApi` and `SystemResource` are `final class`, so they cannot be mocked. OPEN.**
  EPIC 001 declares both `final class` (`10-kanthord-api.md:19`, `09-system-resource.md:19`), and a
  Dart `final` class cannot be implemented outside its own library, so `@GenerateMocks([KanthordApi])`
  does not compile. The EPIC hermetic rule ("The bloc test mocks `KanthordApi`") and
  `docs/testing.md:43` cannot be met as written. Stories `04` and `08` are written against the
  transport seam: a real `KanthordApi` over a `Dio` carrying `MockHttpClientAdapter`, which is the
  seam the optional `Dio?` exists for (`docs/testing.md:49-55`). An interface pair
  (`KanthordApiType` / `SystemResourceType`) was considered and is **not recommended**: it duplicates
  the SDK's public surface for every future resource group, and it does not serve the transport-swap
  motivation, because a different transport is an `HttpClientAdapter` swap under the existing
  `Dio? dio` parameter. The owner still has to amend the one sentence in `docs/testing.md:43` and the
  EPIC hermetic bullet.
- **B2 — the bloc takes `ProbeClientBuilder`, not `KanthordApi`. OPEN.** G2 says the bloc takes
  `KanthordApi` and `AGENTS.md:203-208` says the route passes `getIt<KanthordApi>()`. The
  candidate-probe bullet says the bloc builds a `KanthordApi` over the entered values. The registered
  singleton reads the stored base URL and the stored token, so it cannot probe a candidate. G2 needs
  an owner amendment naming the candidate factory.
- **B3 — the routes. ANSWERED.** The feature declares one route, `/connect`. Read decision 5 below.
- **B4 — the entrypoint. ANSWERED.** `/` is a splash page and it is the one place that holds routing
  conditions. `lib/app/pages/boot_page.dart` becomes that page and is **not** deleted;
  `lib/app/app_routes.dart` is untouched. Read Story `09`.

## Decisions this expansion makes

Seven things the EPIC does not fix. Each is taken at authoring time so that no implementer decides at
build time. **The owner has not confirmed any of them yet. Read the report before `/work` starts.**

- **The bloc takes `ProbeClientBuilder`, not `KanthordApi`.** See B2. The builder seam satisfies the
  candidate rule and keeps the registered singleton untouched.
- **`10.0.2.2` warns.** It is not a loopback address, and `isCleartextRisk` receives a URL with no
  platform context, so it cannot know an emulator typed it. `docs/api/auth.md:99` says to warn when
  the base URL is not loopback.
- **Three failure variants, not four.** G4 names four outcomes and covers `200`, `401`, `403` and a
  connection failure. It covers no `5xx`, no timeout and no decode failure. Those fall to
  `ConnectUnreachable`, and `02` writes the whole truth table.
- **`origin-forbidden` gets its operator message in the feature, and it claims no value.** The SDK
  rewrites `host-forbidden` only (`lib/api/api_exception.dart:66-75`). `probeFailure` branches on
  `code` and picks the config key. The two keys take **different values**: `host-forbidden` wants the
  daemon host the client sent, and `origin-forbidden` wants the page origin such as
  `http://localhost:8080` (`docs/api/connectivity.md:121-123`). Story `08` therefore renders two
  sentences and never tells the operator to add the daemon host to `KANTHORD_HTTP_ALLOWED_ORIGINS`.
  The client does not read its own `Origin` header, so the origin sentence names the key and asks for
  the page origin without inventing the value.
- **The scheme does not exempt the cleartext warning.** The rule is exactly the one G6 states: a host
  that is not loopback warns, `https` included. The daemon serves plain HTTP and ships no certificate
  handling (`docs/api/auth.md:89-91`), so an `https` base URL is a mistake rather than a safe path.
- **A storage failure is its own state.** `ConnectStorageFailed` reports that the daemon answered
  `200` and the client then failed to persist the pair. It is not a probe outcome, `probeFailure`
  never returns it, and the commit restores both previous values before it is emitted.
- **An unusable base URL blocks the probe.** `isUsableBaseUrl` gates the `Connect` button and guards
  the bloc handler, so a value that is not `http`/`https` with a host never reaches `Dio`.
- **No settings route and no unauthorized route.** The EPIC's routes bullet names three routes.
  `KDDialog` already branches full screen below `600` and dialog above, so the settings destination
  is `KDDialog.show` over the connect page and needs no route with an invented scrim. The
  unauthorized state is a `ConnectState` variant, which is what G8 and the outcome rule require, and
  the splash entrypoint of Story `09` is where a future unauthorized branch lands. The feature
  therefore declares one route, `/connect`. **Owner decision B3, answered on 2026-08-10.**
- **`/` is the splash entrypoint and it holds every routing condition.** EPIC 002's `BootPage`
  renders a `notImplemented` placeholder and navigates nowhere, so the epic's gating `NEEDS-HUMAN`
  check cannot reach the feature from a cold start. Story `09` turns that page into the entrypoint:
  it renders a loading `KDStatusView` and resolves one destination, `/connect`. The unauthorized
  branch and a later authentication branch land in the same method. `lib/app/app_routes.dart` is
  untouched, and no EPIC 002 file is deleted. **Owner decision B4, answered on 2026-08-10.**

## Test specification form

Every `test/**` file appears **verbatim**, imports and `setUp` included, as EPIC 002 does. The
implementer copies the file and changes nothing. Story `09` is the one exception: it amends
`test/app/router_test.dart`, which EPIC 002 owns, so it gives five anchored edits instead.

**No Story uses `mockito`.** Read B1. Every hermetic seam is `test/api/dio_mock_adapter.dart` over a
real `KanthordApi`, so no Story runs `make generate-test` and no Story commits a `.mocks.dart`.

## Risks that were raised and closed

- **S1 — the two-store commit was not atomic. CLOSED by Story `04`.** `_commit` reads both previous
  values, and a write that raises restores both and answers `false`. The bloc then emits
  `ConnectStorageFailed`, so a partly replaced configuration neither persists nor reads as success.
- **S2 — an unusable base URL was not validated. CLOSED by Story `03` and Story `08`.**
  `isUsableBaseUrl` gates the button and guards the handler.
- **S3 — `PASS 003-G4-OUTCOMES` did not cover the `200` outcome. CLOSED by Story `02`.**
  `probe_outcome_test.dart` now asserts the proven outcome's state shape and asserts that
  `probeFailure` never produces it.
- **S4 — the `https` exemption was an unrecorded policy. CLOSED by Story `03`.** The exemption is
  removed; the rule is the one G6 states.

## Facts (needed for implementation)

- **`GET /v1/health` returns a bare object, not an envelope.** Only errors are enveloped.
  `docs/api/contract/examples/system.health.json:1-17`. The roll-up field is `status` (`ok`,
  `degraded`), the list field is `dependencies`, and a dependency status is `ok`, `failed` or
  `not-implemented` (`docs/api/contract/features/system.yaml:454-480`).
- **The error codes are literal strings.** `401 unauthenticated`, `403 origin-forbidden`,
  `403 host-forbidden` (`docs/api/errors.md:30-32`). Branch on `code`, never on `message` and never
  on the HTTP status (`docs/api/errors.md:18`).
- **The `403 host-forbidden` body carries no `details`** (`system.yaml:118-129`), so the client
  supplies the host itself from the base URL it sent.
- **`ApiException.fromDio` already rewrites `host-forbidden`** with the host and
  `KANTHORD_HTTP_ALLOWED_HOSTS` (`lib/api/api_exception.dart:66-75`). It leaves `origin-forbidden`
  generic (`:76-81`).
- **The web opaque message is already built in the SDK** (`lib/api/api_exception.dart:25-32`) and it
  names the four causes and the two config keys. `ConnectUnreachable.detail` passes it through, and
  `isOpaque` records that the client cannot claim one cause. The collapse applies to
  `ApiNoNetworkException` alone.
- **`kApiIsWeb`** is `const bool kApiIsWeb = bool.fromEnvironment('dart.library.js_interop');`
  (`lib/api/api_platform.dart:1`). `ConnectBloc` takes it as a default argument so a test pins it.
  Nothing has yet proven it resolves `true` in Chrome — that is the deferred `NEEDS-HUMAN` from
  `.agent/plan/stories/001-transport-foundation/04-web-opaque-failure-message.md:81-86`, and Story
  `09` discharges it.
- **`WireEnum` keeps the raw wire string** (`lib/api/models/wire_enum.dart:5-20`). `known` is `null`
  for an unknown value and `raw` always holds the server string, so `HealthView` renders `raw`.
- **`KanthordApi({required ApiConfig config, required TokenProviderType tokens, Dio? dio})`** with a
  public `final Dio dio` and `late final SystemResource system`
  (`.agent/plan/stories/001-transport-foundation/10-kanthord-api.md:10-36`). The optional `Dio` is
  the transport seam `connect_candidate_test.dart` uses.
- **`ApiConfig` resolves the base URL per call** through `BaseUrlProviderType`
  (`lib/api/api_config.dart:9-27`). That is why a candidate client is a fresh `ApiConfig` over a
  fresh provider, and the registered singleton never moves.
- **`BaseUrlStoreType`** adds `read()`, `save(String)` and `clear()` over
  `BaseUrlProviderType.baseUrl()`, and `PreferencesBaseUrlProvider.baseUrl()` throws `StateError`
  when the key is absent (`.agent/plan/stories/002-app-composition/02-base-url-store.md:8-59`). The
  connect flow calls `read()` and `save()` only, never `baseUrl()`.
- **`TokenProviderType` already declares `token()`, `save(String)` and `clear()`**
  (`lib/api/token_provider.dart:1-5`).
- **`Env.apiEndpoint` is a `static const String` holding `http://localhost:31415`**
  (`.agent/plan/stories/002-app-composition/05-env-classes.md:30-42`). It is a prefill. A stored
  value always wins.
- **`configureDependencies` registers six lazy singletons** and nothing else
  (`.agent/plan/stories/002-app-composition/03-injection-root.md:18-52`).
- **`KDInputField` obscures with `isObscured`, errors with `error`, and builds its own reveal
  control** (`lib/libraries/kd_design_system/atoms/kd_input_field.dart:5-34`, `:58-66`). It takes a
  `controller` **or** an `initialValue`, never both. `KDButton` uses `isBusy` and `isEnabled`, and
  `isBusy: true` also blocks the press (`atoms/kd_button.dart:5-38`, `:94`).
- **`KDDialog.show<T>(context, builder:)`** is the static entry, and `KDDialog.build` itself branches
  full screen below `600` and `Dialog` at `600` and above
  (`layout/kd_dialog.dart:27-38`, `:118-128`). The caller never branches.
- **`KDCardList` is an unbounded `ListView`** (`organisms/kd_card_list.dart:51-55`) and overflows
  inside the `SingleChildScrollView` of `KDFullScreenLayout`. `HealthView` is a `Column` of `KDCard`.
- **Breakpoints are `kdWideBreakpoint = 600` and `kdExpandedBreakpoint = 840`**, read through
  `context.kdLayout` under a `KDLayout` ancestor (`layout/kd_layout.dart`). Assert `599` and `600`,
  never `500` and `700` (`docs/testing.md:118-124`).
- **`scripts/arch-check.sh:105-106` bans `Color(0x`, `Colors.<lowercase>`, `TextStyle(` and
  `BorderRadius.circular(<digit>)` under `^lib/features/`.** `BorderRadius.circular(tokens.radius.md)`
  passes. **`:88-89` bans every `//` and `///` comment under `lib/(api|features)/`.**
  **`:70-71` bans `Navigator.push`, `pushNamed`, `pushReplacement` and `of(context).push`, but not
  `pop`.** Generated files are excluded by the `find` filter at `:23-29`.
- **`go_router_builder` 4.4.0 emits one `$appRoutes` per annotated library.** Two annotated files
  therefore need two prefixed imports in `lib/app/router.dart`.
- **`test/api/dio_mock_adapter.dart` provides `MockHttpClientAdapter` and `jsonResponse`** and is
  reachable from `test/features/daemon_connect/connect/` as `'../../../api/dio_mock_adapter.dart'`.
  It imports no `dart:io`.
- **`make generate` is forbidden to both roles.** The software-engineer runs `make generate-lib`, the
  test-engineer runs `make generate-test`, and every generated file is committed. Only Stories `01`
  and `09` generate anything, and both are `make generate-lib`.
- **`context.kdTokens` is `Theme.of(this).extension<KDTokens>()!`**
  (`libraries/kd_design_system/styles/kd_tokens.dart:235-237`). Any test that pumps a page must pass
  `theme: KDTheme.light()`, or the null assertion throws. EPIC 002's `test/app/router_test.dart`
  `_pump` has no theme today, which is Edit 5 of Story `09`.
- **A `BlocConsumer` listener does not fire for the state that is already current at mount.**
  `ConnectPage` therefore seeds its two controllers in `didChangeDependencies` and uses the listener
  for later changes only.
- **`flutter_bloc` does not serialise handlers into a single flight.** `ConnectBloc` guards every
  handler with `if (state is ConnectProbing) return;`, so two presses send one request and an
  in-flight probe always commits the values it started with.
- **`make verify` is not the EPIC Proof.** `Makefile:125` expands it to
  `format-check analyze arch-check test pipeline-test`, and it passes at the end of every Story. The
  EPIC `Proof:` block names files later Stories create and runs one time at the end.
