# Handoff: deferred work

Read `CLAUDE.md` first for the architecture and the naming, `DESIGNS.md` for the design rules,
`docs/operations.md` for the commands and the platform specifics, and `docs/testing.md` for the test
conventions. This document holds what is not built and what blocks it.

**Read `docs/api/` before step 4 or step 5.** It is the daemon contract, snapshotted from the
`kanthord-engine` repository at commit `a5b957d`, daemon version `27.8.1`. It answers the API and
auth blockers below, and it changes the scope of both steps. Start at `docs/api/README.md`, then read
`docs/api/blockers.md` for what is still open and who owns it.

Status date: 2026-08-05.

## Done and verified

| Step | Scope                                                                                                                                                                                                            | Verification                                                                                                                                                                                    |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Project scaffold, six platform targets                                                                                                                                                                           | `flutter build macos --debug`, `flutter build web`, `flutter build ios --debug --no-codesign`, `flutter build apk --debug` all pass. Windows and Linux never compiled                           |
| 2    | Tooling                                                                                                                                                                                                          | `make analyze` clean, `make format-check` passes. Commitlint accepts `feat(api): add the sessions resource` and rejects an unknown type, a malformed header, and a trailing period              |
| 3    | KD design system: tokens, layout family, `KDText`, `KDCard`, `KDCardList`, `KDAdaptiveScaffold`                                                                                                                  | `make test` 6/6. Gallery checked on the real macOS app in light and dark, at 520 pt (`mobile`) and 1100 pt (`wide`)                                                                             |
| 3b   | The two page layouts, the `expanded` family at 840, `KDButton`, `KDInputField`, `KDBrand`, `KDTopBar`, `KDSideBar`, `KDStatusView`, `KDPaneView`, `KDDialog`, plus `KDTokens.sizing` and `KDTokens.statusColors` | `make test` 104/104, `make analyze` clean, `make format-check` passes. Gallery checked on the real macOS app in light and dark, at 520 pt (`mobile`), 760 pt (`wide`), and 1200 pt (`expanded`) |

Windows and Linux were never compiled. No Windows host and no Linux host exist here, and CI is
removed, so no machine builds them at all.

## Blocked: answers needed from the owner

Do not guess any of these. Each one blocks the work named next to it.

| Question                                                                                      | Blocks                                               | State                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The API contract: endpoints, request shapes, response shapes, SSE event names                 | The models, the resource classes, the SSE event type | **Partly answered.** Endpoints, errors, conventions and auth are in `docs/api/`. Request and response shapes do not exist yet on 31 of 54 operations. There are no SSE event names, because SSE is withdrawn — the client long-polls. See `docs/api/blockers.md` E2 and `docs/api/polling.md` |
| The auth flow: how a user signs in, the refresh endpoint path and payload, the token lifetime | The auth interceptor, the sign-in feature            | **Answered.** There is no sign-in, no refresh and no lifetime. One static bearer token. See `docs/api/auth.md`                                                                                                                                                                                |
| The LAN IP of the development machine                                                         | Running on a physical device                         | Still open. It is a value the human enters, not a constant. See `docs/api/connectivity.md`                                                                                                                                                                                                    |
| The HTTPS base URL                                                                            | A production web bundle                              | **Answered.** Web is supported. A direct HTTPS page cannot call a plain-HTTP daemon, so an HTTPS bundle goes through a reverse proxy that serves the app and forwards a same-origin path. See `docs/api/connectivity.md`                                                                      |
| The real color palette, type scale, and spacing scale from the design file                    | Replacing every `// TODO(tokens)` value              | Still open                                                                                                                                                                                                                                                                                    |

Step 5 is settled: it is `daemon_connect`. **D1** is now only the feature _after_ it, and every
candidate is gated on engine work rather than on a product debate. **D2** (web is supported), **E7**
(the idempotency key) and the removal of the chat feature are decided. **D3** (the LAN cleartext
posture) travels with device testing. All of them are in `docs/api/blockers.md`.

## The daemon serves two operations today, and the client does not wait

The engine registry declares 54 operations. The daemon wires **two** handlers: `GET /v1/health` and
`GET /v1/db/status`. Every other operation, including `project.list`, `node.list` and `event.list`,
answers `501 not-implemented`.

The owner has decided that the client builds the UI in parallel and integrates per operation as each
handler lands. **`docs/api/parallel-development.md` is the working plan, and it is binding.** Read it
before writing any UI code. In summary:

- Build the whole transport, the design system, the router, and every view state now, against a
  fixture-backed **mock HTTP daemon on loopback**. Not against a fake `KanthordApi` — a fake proves only
  that Dart compiles, and the defects live in the real Dio path.
- Build `daemon_connect` against the **real** daemon. `system.health` works today.
- Do not hand-write a wire model and treat it as the contract. The engine authors schemas ahead of its
  handlers in EPIC 004.5, and models come from that artifact.
- Simulation must be impossible to mistake for integration. Six safeguards, all required, listed in that
  document. A polished build whose writes reach nothing is the way this plan fails.

## Step 4: the `lib/api/` SDK

Target layout and every rule live in `CLAUDE.md`. The contract lives in `docs/api/`. Verification is
the `test/api/` suite.

**Read `docs/api/` first.** It changes six things in the plan below, and each is a correction rather
than a detail:

- Step 4c collapses. There is no refresh flow to build. Read `docs/api/auth.md`.
- **The SSE client is withdrawn entirely.** `sse/` becomes `polling/`. Read `docs/api/polling.md`.
- `models/` comes from the engine's schemas, not from this repository's reading of engine prose. A
  provisional DTO is allowed under stated terms. Read 4b below and
  `docs/api/parallel-development.md`.
- `build.yaml` has dropped `field_rename: snake`. The wire is camelCase. Read
  `docs/api/conventions.md`.
- The retry rule changes: `GET` always, a keyed `POST` yes, nothing else. Read the retry and
  idempotency sections of `docs/api/errors.md`.
- Web is supported. Read `docs/api/connectivity.md`.

### 4a. Buildable now, no answer needed

**`api_config.dart`** — hold the base URL and the timeouts. **Do not hard-code a host or a port.**
The base URL is a stored value. `http://localhost:31415` is the agreed convention and the app layer
prefills it, so the SDK never substitutes it for a missing value, and `localhost` on a phone is still
the phone. Read `docs/api/connectivity.md` for the per-target table and the platform traps, and
`docs/api/auth.md` for the provisioning flow that supplies it.

Send `X-Kanthord-Client: <version>` on every request. Set the receive timeout per operation, not
once: `repository.inspect` and `repository.register` reach a network forge and take seconds.

**`api_exception.dart`** — `sealed class ApiException`. Seven subclasses, one more than the original
list: no network, timeout, unauthorized, **not implemented**, response error, decode error,
cancelled. `docs/api/errors.md` holds the full code-to-subclass mapping and the 22 error codes.

`ApiNotImplementedException` is new and it earns its place: 52 of 54 operations answer
`501 not-implemented` today. A screen must render "the daemon does not do this yet" and not a red
error banner.

Every error is one envelope: `{"error":{"code","message","details"}}`. Branch on `code`. Never parse
`message`. Tolerate an unknown code.

For the web case: a browser reports an origin rejection, a host rejection, a daemon that is down and a
DNS failure identically, as a generic network error with no status and no body. A web build cannot tell
them apart, so name all four causes in the message and name the two daemon config keys. Do not claim a
precise cause on web. Keep the precise messages on native, where the failures are distinguishable.
Read `docs/api/connectivity.md`.

**`token_provider.dart`** — one token, because there is no refresh token:

```dart
abstract class TokenProviderType {
  Future<String?> token();
  Future<void> save(String token);
  Future<void> clear();
}
```

Two implementations in the app layer, not in `lib/api/`:

- Native: `flutter_secure_storage`, which uses the keychain and the keystore.
- Web: memory only. The web build of `flutter_secure_storage` cannot match a native keychain, and
  any same-origin script reads what it holds. A web session ends when the tab closes. That is
  intended.

Never write the token to `shared_preferences` and never to `localStorage`. The daemon token never
expires and cannot be revoked from the client, so a leak does not age out.

**`interceptors/retry_interceptor.dart`**:

- **Retry `GET` always. Retry a `POST` that carries an `Idempotency-Key`. Retry nothing else
  automatically.** A `PUT` and a `DELETE` are each a human action behind a button, and HTTP method
  semantics prove nothing about an implementation. `HEAD` is not in the contract at all.
- Retry on a connection error, on a timeout, and on 502, 503, 504. Never on another 4xx, and never on
  a 501.
- Three attempts total. Backoff 200 ms then 800 ms, with jitter. **Take the `Random` in the
  constructor** and seed it in the test, or the backoff cannot be asserted.
- Stop immediately when the caller cancels. A cancelled request is never retried.
- Never retry `host-key-mismatch`, `idempotency-mismatch`, `unauthenticated` or `not-implemented`.

**`interceptors/idempotency_interceptor.dart`** — attach `Idempotency-Key` to a `POST`. The key comes
from the call site, not from the interceptor, because it belongs to the user's intent: **one key per
logical operation, never one per HTTP attempt.** A new key on each retry makes the whole mechanism a
no-op. Serialize the body once and resend the same bytes, because the daemon fingerprints them.

The engine guarantee is bounded same-process duplicate suppression, not exactly-once. Read the
idempotency section of `docs/api/errors.md` before writing this, and never render "safe to retry" in
the UI.

**`polling/` replaces `sse/`.** Build no framing parser, no `SseClientType`, no conditional import, no
browser `fetch` reader, no `AbortController`, no `EventSource`, and no `AgentEvent`. The client watches
work by polling `event.list` with a cursor.

`docs/api/polling.md` holds the whole design and every rule is mandatory: cursor advancement, draining a
full page immediately, sleeping only on a short page, the four failure classes, the difference between a
daemon-side wait elapsing and a receive timeout, backpressure, restart position, and the four
web-specific costs. Take the clock and the `Random` in the constructor.

The web transport needs nothing special. Long polling runs on the ordinary Dio browser adapter once the
daemon allows the origin, which is the main reason SSE was withdrawn: a browser cannot use `EventSource`
against a bearer-token API at all.

### 4b. The wire models, and the mock daemon that lets the UI proceed without them

Read `docs/api/parallel-development.md` first. This is a summary of it, not a replacement.

- **`test/mock_daemon/` comes first.** A fixture-backed `HttpServer` on `127.0.0.1:0` that the real Dio
  talks to. It enforces the contract it stands for: no token is a real `401` envelope, a missing fixture
  is a real `501`, and `after` plus `limit` page a real list. It serves the scenarios a happy path never
  produces. This is buildable today and it unblocks every screen.
- `models/` — the shapes come from the engine, not from this repository.
  `kanthord-engine/.agent/plan/epics/004.5-contract-schemas.md` authors a zod schema and a validated
  example per operation **ahead of the handlers**, which is what makes this the shortest path. Generate
  or hand-write a model against that artifact when it lands.
- **The SDK stays thin. There is no mapping layer and no view-model layer.** One model per wire shape,
  and the UI reads it: `NodeListState.loaded(List<Node>)` is correct, and a row widget may take a `Node`.
  Where a field is volatile or a row widget is reused widely, project primitives or a Dart record inside
  the state file — no mapper class, no repository, no use case, no extra `get_it` entry. `CLAUDE.md`
  forbids each of those and none is needed.
- When you write a model: `@freezed` plus `@JsonSerializable`, `@JsonKey(name:)` on every field, and
  **no `field_rename`**. `build.yaml` already has it removed. See
  `docs/api/conventions.md`.
- **`@JsonKey(name:)` hides a wire rename from the compiler**, so the contract suite asserts the wire
  field names against the engine's example — not merely that decoding succeeded. Three other changes are
  also runtime failures rather than compile errors: a field becoming nullable, an unknown enum value, and
  a daemon version skew. `docs/api/parallel-development.md` lists the assertion each one needs.
- `resources/` — nine classes, listed with their operations at the end of `docs/api/operations.md`. A
  method for an operation with no schema is a guess that compiles.
- `kanthord_api.dart` — holds one `Dio`, built from `ApiConfig` when the caller passes none, and
  exposes the resource groups so a call site reads as an SDK.
- **The contract suite runs from day one**, against the mock, on every `make test`. It is never a skipped
  test. The same suite runs against a live daemon per operation as each handler lands.

### 4c. Deleted, not blocked

There is no auth flow to wait for. One static bearer token, no sign-in, no refresh endpoint, no
lifetime. `docs/api/auth.md` holds the whole interceptor and lists every item deleted from the
original 4c plan: the single-flight refresh `Future`, the second `Dio`, the refresh-once-per-token
rule, `refreshToken()`, and the three-concurrent-401s test.

`interceptors/auth_interceptor.dart`, in full:

- Read the token through `TokenProviderType`. Attach `Authorization: Bearer <token>`.
- A null or empty token throws `ApiUnauthorizedException` before the request leaves.
- On a `401`, throw `ApiUnauthorizedException`. Never retry and never refresh.
- **Do not clear the stored token on a 401.** It is the only value the human typed, and they need to
  see it to fix it. Only an explicit user action clears it.

### Step 4 verification

`test/api/` must cover, at minimum:

- `system.health` and `system.db` against a `Dio` mock adapter. Assert the path, the headers and the
  decoded model. They are the only two operations with a schema and a handler, so they are the only
  two that can be asserted against real daemon bytes.
- `EventPoller`, with a mock adapter, an injected clock and a seeded `Random`. Assert: the cursor
  advances only after delivery; a full page is drained without sleeping; a short page sleeps; nothing
  is emitted after cancellation, including when the response wins the race; a `401` stops the poller
  and a `503` backs off; and a receive timeout is reported as a transport failure, not as an empty
  page.
- Error envelope: each of the seven `ApiException` subclasses from a mock response. Assert that an
  unknown `code` becomes `ApiResponseException` and never a decode error.
- Auth interceptor: assert the bearer header, assert a 401 throws, and assert the stored token
  survives a 401.
- Retry interceptor: assert a `POST` with no key is never retried, assert a `POST` with an
  `Idempotency-Key` is retried **with the same key and the same body bytes**, assert a `PUT` is never
  retried, and assert the backoff schedule with a seeded `Random`.

Also assert by inspection that `lib/api/` imports nothing from `lib/features/`, `lib/app/`, or
`lib/libraries/`.

## Step 5: the `daemon_connect` feature

There is no chat feature in the MVP. The owner has removed it from both repositories. The daemon ships
no route that accepts a prompt and no route that streams, and the engine records the refusal as an
invariant in `kanthord-engine/docs/proposal/after-the-mvp.md`: no operation invokes an agent outside a
project, a run, a node, an attempt and a durable audit record.

The daemon is a plan-and-DAG execution engine. A human imports a plan of initiative, objective and task
nodes, the daemon runs a scheduler pass, a coding agent executes a task, and a reviewer agent judges it.
This client is a **control surface for that engine**. Do not add a chat page, a prompt box, a message
list, or an `AgentEvent` type. Do not name a branch or a feature `agent-chat`.

### Scope

The base URL and token provisioning flow of `docs/api/auth.md`, verified against `GET /v1/health`.

This is step 5 because it is forced rather than chosen: no other screen works without it, and it is the
only slice that reaches a live daemon today. It exercises the whole SDK — config, transport, auth, the
error envelope and model decoding — against the two operations that have a handler.

```
features/daemon_connect/
├── daemon_connect.dart          # barrel: routes only
├── daemon_connect_routes.dart   # @TypedGoRoute
└── connect/
    ├── connect_bloc.dart        # takes KanthordApi and TokenProviderType
    ├── connect_state.dart       # @freezed sealed class
    ├── connect_page.dart
    └── widgets/
```

The `GET /v1/health` probe distinguishes four failures, and the page must render each differently: a
`200` proves the URL, the `Host` allow list and the token together; a `401` names the token; a `403`
names the daemon configuration and shows the host the client sent; a connection failure names the URL.
On web the four are indistinguishable — read `docs/api/connectivity.md` for the operator message each
one needs, and for the web wording.

Warn the human when the base URL is not loopback. The token then crosses the network in clear text and
it never expires.

Also render the `system.health` body once connected: the roll-up plus each dependency. It is the only
real data the daemon serves today, and it proves the decode path end to end.

### What comes after, and what gates it

Nothing else is scheduled. The client can render agent output only through `node.attempts`,
`attempt.show`, `node.checks` and `blob.show`, and it can start work only through `run.start`. **All of
those are engine phase 2, and no phase-2 epic exists yet.** The graph read routes — `project.list`,
`node.list`, `edge.list`, `event.list` — are phase 1 and still answer `501`.

So the next feature is an owner decision, and it is **D1** in `docs/api/blockers.md`. Do not pick one.
Two rules will apply to it whatever it is:

- Progress comes from polling `event.list` with the cursor, never from a stream. Read
  `docs/api/polling.md`. Do not poll at 1 Hz to animate progress.
- A blob is fetched lazily, when the user opens it. An attempt cites a prompt, a diff and a check log as
  hashes, and three attempts multiply that. Read the blob section of `docs/api/conventions.md`.

### Design system work step 5 needs

Build each one in the order from `DESIGNS.md`: document, implement, add to `KDGalleryPage`, verify in
four combinations.

| Component      | Layer  | State     | Needed by                                                                          |
| -------------- | ------ | --------- | ---------------------------------------------------------------------------------- |
| `KDButton`     | atom   | **built** | Stage one. Connect                                                                 |
| `KDInputField` | atom   | **built** | Stage one. The base URL field and the token field                                  |
| `KDDialog`     | layout | **built** | Stage one. The settings destination, full screen on `mobile` and above it a dialog |
| `KDPaneView`   | layout | **built** | Stage two. A node list and a node detail, split above `mobile`                     |

Neither `KDPaneView` nor `KDDialog` is a page layout: the pane view belongs in the content region of
`KDShellLayout` and the dialog belongs above either page layout. Read the page layout section of
`DESIGNS.md`.

The connect page, the unauthorized page and the boot page use `KDFullScreenLayout` with
`KDStatusView`. **Step 5 needs no new design system component.** Every one in the table is built.

`KDInputField` carries the obscured text mode and the reveal control the token field needs.

### App layer work this step needs

`lib/app/` still has no dependency injection and no router.

- Register `KanthordApi` once in `get_it` as a lazy singleton.
- Register the `TokenProviderType` implementation, selected per platform.
- Replace `home: KDGalleryPage(...)` in `kanthord_app.dart` with the `go_router` configuration.
  Keep a route to the gallery for development if you want one, but it is not a product destination.
- Add `lib/app/env/` with the `envied` classes, plus `.env.staging` and `.env.production`. Put no
  server secret in either file. A web build ships readable JavaScript, so anything in the bundle is
  public. **Put no daemon token in either file** — one token serves one human and it never expires.
- Register the settings store for the base URL. It is not a build-time constant. Read
  `docs/api/connectivity.md`.
- Pin the development web port in the `Makefile`: `flutter run -d chrome --web-port=8080`. The daemon
  matches an origin exactly, so a random port cannot be configured. Read `docs/api/connectivity.md`.
- Add the cleartext-HTTP platform exceptions for Android and iOS, scoped to the configured host. Never
  a blanket exception. Read `docs/api/connectivity.md`.

### Step 5 verification

- The bloc test, with `KanthordApi` mocked. Do not mock a repository, because none exists.
- Run stage one against a real daemon on macOS. The daemon needs `KANTHORD_HTTP_PORT` and
  `KANTHORD_HTTP_TOKEN` set, and `KANTHORD_HTTP_ALLOWED_HOSTS` must admit the host the client sends.
- Run stage one against a real daemon from a physical device. It needs a non-loopback daemon bind, the
  LAN address in the client, that address in the daemon `Host` allow list, and the cleartext-HTTP
  platform exception of `docs/api/connectivity.md`.
- **Run stage one on web.** It needs the pinned web port and
  `KANTHORD_HTTP_ALLOWED_ORIGINS=http://localhost:8080` on the daemon, and it needs engine EPIC 010.5
  to have landed. Assert that a wrong origin still answers `403 origin-forbidden`, so the allow list is
  proved to be a list rather than an opening. Name the browsers the product supports and run it on
  each. Read `docs/api/connectivity.md`.

## Deferred: continuous integration

CI is removed until the MVP lands. Both workflows were written and verified as YAML, then deleted.
**Restore them from commit `256c510` (`ci: add the pull request check and the six-target build
matrix`) rather than writing them again.**

Until then every check is local and manual. Nothing prevents an unformatted, failing, or
non-compiling change from reaching `main`.

What CI must do when it returns:

`check-pull-request.yml`, on every pull request to `main`:

- Branch-name check, using this pattern and no other:

  ```
  ^(feat|fix|chore|refactor|test|docs|style|perf|ci|build)/[a-z0-9]+(-[a-z0-9]+)*$
  ```

  The version in `256c510` enforced an issue key. Drop that line when you restore the workflow.

- `make format-check`. Never `make format`, because a job that rewrites files hides the difference it
  should report.
- `flutter analyze`.
- `flutter test`.

`build-matrix.yml`, on a push to `main` and on manual dispatch, one job per host:

| Host             | Targets                                                                         |
| ---------------- | ------------------------------------------------------------------------------- |
| `ubuntu-latest`  | Linux, web. Needs `clang cmake ninja-build pkg-config libgtk-3-dev liblzma-dev` |
| `macos-latest`   | macOS, iOS (`--no-codesign`), Android. Needs Java 17                            |
| `windows-latest` | Windows                                                                         |

Six declared platforms need six compile checks, or a broken target stays hidden for months. Do not
run the matrix on every pull request; it is slow and most changes touch no platform code.

Both workflows pinned `FLUTTER_VERSION: 3.44.8` and used `subosito/flutter-action@v2` with
`cache: true`. Keep the pin equal to `.fvmrc`.

## Step 6: documentation

- `lib/api/README.md` — do not restate the resource table. `docs/api/operations.md` owns it. Write
  only what is specific to the Dart SDK: the resource-class-to-operation map, and a pointer to
  `docs/api/`.
- Update `CLAUDE.md`: move each item out of "Current state" as it lands, and delete the bootstrap
  exceptions once the router and the first feature exist. Its premise, base URL, progress and web-interop
  statements are already corrected, and `package:web` is already removed from `pubspec.yaml`.
- Update `docs/operations.md` when the `build.yaml` paths start producing output, when
  `.env.staging` and `.env.production` exist, and with the pinned `--web-port` command.
- Update `lib/libraries/kd_design_system/README.md` with every new component.
- A technical document per new molecule, organism, and template.

## Known gaps carried forward

- Every design token is seeded from the Material 3 baseline and marked `// TODO(tokens)`. The seed
  is `0xFF6750A4`. Nothing here is a brand value. **Every seeded value now lives in `KDTokens`**,
  including `sizing` and `statusColors`, so the design file lands as one edit per token rather than a
  hunt through the components. The mark in `KDBrand` is the exception: it is a placeholder icon and
  it waits on a brand asset, not on a token value.
- `styles/kd_fonts.dart` and `styles/kd_shadow_styles.dart` are absent on purpose. No font asset
  exists, and Material 3 expresses depth with elevation. Create each when a real value arrives.
- `freezed` is pinned to `^3.2.5` and `mockito` to `^5.6.4`. Both stable. `freezed` stable needs
  `analyzer <11 or ^12`; `mockito >=5.7.0` needs `analyzer >=13`. They cannot both be newest.
  Revisit when `freezed` 4 reaches stable.
- Nothing enforces the branch name now that CI is removed. The convention is documented in
  `CLAUDE.md` and the exact pattern for the restored CI check is above.
- Windows and Linux have never been compiled, on any machine.
